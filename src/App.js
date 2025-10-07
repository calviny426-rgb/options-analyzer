import React, { useState, useEffect, useCallback } from 'react';

const OptionsAnalyzer = () => {
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockPrice, setStockPrice] = useState(0);
  const [volatility, setVolatility] = useState(0);
  const [expirationDates, setExpirationDates] = useState([]);
  const [selectedExpiration, setSelectedExpiration] = useState(null);
  const [optionChain, setOptionChain] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('call');
  const [results, setResults] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const strategies = [
    { value: 'call', label: 'Long Call', legs: 1 },
    { value: 'put', label: 'Long Put', legs: 1 },
    { value: 'vertical_call_spread', label: 'Bull Call Spread', legs: 2 },
    { value: 'vertical_put_spread', label: 'Bear Put Spread', legs: 2 },
    { value: 'iron_condor', label: 'Iron Condor', legs: 4 },
    { value: 'butterfly', label: 'Butterfly', legs: 3 },
    { value: 'straddle', label: 'Straddle', legs: 2 },
    { value: 'strangle', label: 'Strangle', legs: 2 },
  ];

  const fetchOptionData = async () => {
    if (!stockSymbol) {
      setError('Please enter a stock symbol');
      return;
    }

    setLoading(true);
    setError(null);
    setOptionChain(null);
    setSelectedOptions([]);

    try {
      const response = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/options/${stockSymbol}`
      );

      if (!response.ok) {
        throw new Error('Invalid symbol or no data available');
      }

      const data = await response.json();
      
      if (!data.optionChain || !data.optionChain.result || data.optionChain.result.length === 0) {
        throw new Error('No option data available for this symbol');
      }

      const result = data.optionChain.result[0];
      const quote = result.quote;

      setStockPrice(parseFloat(quote.regularMarketPrice.toFixed(2)));
      
      // Set expiration dates
      const expDates = result.expirationDates.map(ts => ({
        timestamp: ts,
        date: new Date(ts * 1000).toLocaleDateString(),
        daysToExp: Math.ceil((ts * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
      }));
      setExpirationDates(expDates);
      setSelectedExpiration(expDates[0].timestamp);

      // Load first expiration
      await loadExpirationData(stockSymbol, expDates[0].timestamp, quote.regularMarketPrice);

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadExpirationData = async (symbol, expirationTs, currentPrice) => {
    try {
      const response = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/options/${symbol}?date=${expirationTs}`
      );

      const data = await response.json();
      const result = data.optionChain.result[0];
      const options = result.options[0];

      // Filter and sort options
      const calls = options.calls
        .filter(c => c.lastPrice > 0 && c.strike >= currentPrice * 0.7 && c.strike <= currentPrice * 1.3)
        .sort((a, b) => a.strike - b.strike);

      const puts = options.puts
        .filter(p => p.lastPrice > 0 && p.strike >= currentPrice * 0.7 && p.strike <= currentPrice * 1.3)
        .sort((a, b) => a.strike - b.strike);

      // Calculate average IV
      const avgIV = [...calls, ...puts]
        .filter(o => o.impliedVolatility)
        .reduce((sum, o, i, arr) => sum + o.impliedVolatility / arr.length, 0);
      
      setVolatility(parseFloat((avgIV * 100).toFixed(1)));

      setOptionChain({ calls, puts });
    } catch (err) {
      setError('Failed to load expiration data');
    }
  };

  const handleExpirationChange = async (expirationTs) => {
    setSelectedExpiration(expirationTs);
    setLoading(true);
    setSelectedOptions([]);
    await loadExpirationData(stockSymbol, expirationTs, stockPrice);
    setLoading(false);
  };

  const toggleOptionSelection = (option, type) => {
    const optionWithType = { ...option, type };
    const isSelected = selectedOptions.some(
      o => o.contractSymbol === option.contractSymbol
    );

    if (isSelected) {
      setSelectedOptions(selectedOptions.filter(
        o => o.contractSymbol !== option.contractSymbol
      ));
    } else {
      const strategy = strategies.find(s => s.value === selectedStrategy);
      if (selectedOptions.length < strategy.legs) {
        setSelectedOptions([...selectedOptions, optionWithType]);
      }
    }
  };

  const calculateStrategy = () => {
    if (selectedOptions.length === 0) return null;

    const T = expirationDates.find(e => e.timestamp === selectedExpiration)?.daysToExp / 365 || 0.25;
    const r = 0.05;
    const sigma = volatility / 100;

    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);

    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);

    // Calculate current cost
    let currentCost = 0;
    selectedOptions.forEach(opt => {
      currentCost += opt.lastPrice;
    });

    // Calculate values after moves
    const calcOptionValue = (S, opt) => {
      if (opt.type === 'call') {
        return Math.max(0, S - opt.strike);
      } else {
        return Math.max(0, opt.strike - S);
      }
    };

    let valueUp = 0;
    let valueDown = 0;
    selectedOptions.forEach(opt => {
      valueUp += calcOptionValue(stockUp, opt);
      valueDown += calcOptionValue(stockDown, opt);
    });

    const profitUp = valueUp - currentCost;
    const profitDown = valueDown - currentCost;
    const percentGain = ((profitUp / currentCost) * 100).toFixed(1);
    const percentLoss = ((profitDown / currentCost) * 100).toFixed(1);
    const rewardRiskRatio = currentCost > 0 ? (Math.abs(profitUp) / currentCost).toFixed(2) : '0.00';

    return {
      currentCost: currentCost.toFixed(2),
      profitUp: profitUp.toFixed(2),
      profitDown: profitDown.toFixed(2),
      percentGain,
      percentLoss,
      rewardRiskRatio,
      maxGain: profitUp > 0 ? profitUp.toFixed(2) : 'Limited',
      maxLoss: currentCost.toFixed(2)
    };
  };

  useEffect(() => {
    if (selectedOptions.length > 0) {
      const result = calculateStrategy();
      setResults(result);
    } else {
      setResults(null);
    }
  }, [selectedOptions, stockPrice, volatility, selectedExpiration]);

  if (showLanding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12 animate-fade-in">
            <div className="mb-8 flex justify-center">
              <div className="text-9xl">🐅</div>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Tiger Options
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 mb-8">
              Real-time options chain with professional strategy analysis
            </p>
            <button
              onClick={() => setShowLanding(false)}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Get Started
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-orange-500 transition-all">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-white mb-2">Live Option Chains</h3>
              <p className="text-zinc-400">Real-time option prices from Yahoo Finance</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-orange-500 transition-all">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-white mb-2">Interactive Selection</h3>
              <p className="text-zinc-400">Click to build multi-leg strategies instantly</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-orange-500 transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-white mb-2">Smart Analysis</h3>
              <p className="text-zinc-400">Instant risk/reward calculations</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🐅</span>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                Tiger Options
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Fetch */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Stock Symbol
              </label>
              <input
                type="text"
                placeholder="Enter symbol (e.g., AAPL, TSLA, SPY)"
                value={stockSymbol}
                onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && fetchOptionData()}
                className="w-full px-4 py-3 bg-black border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchOptionData}
                disabled={loading || !stockSymbol}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    🔄 Fetch Options
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Stock Info & Expiration */}
        {stockPrice > 0 && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-6 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-sm text-zinc-400">Stock Price</div>
                <div className="text-2xl font-bold text-white">${stockPrice}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Implied Volatility</div>
                <div className="text-2xl font-bold text-orange-500">{volatility}%</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Symbol</div>
                <div className="text-2xl font-bold text-white">{stockSymbol}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Strategy</div>
                <select
                  value={selectedStrategy}
                  onChange={(e) => {
                    setSelectedStrategy(e.target.value);
                    setSelectedOptions([]);
                  }}
                  className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
                >
                  {strategies.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {expirationDates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Expiration Date
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {expirationDates.slice(0, 8).map(exp => (
                    <button
                      key={exp.timestamp}
                      onClick={() => handleExpirationChange(exp.timestamp)}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                        selectedExpiration === exp.timestamp
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {exp.date} ({exp.daysToExp}d)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Options Display */}
        {selectedOptions.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Selected Options ({selectedOptions.length})</h3>
            <div className="space-y-2">
              {selectedOptions.map((opt, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black border border-zinc-800 rounded-lg p-3">
                  <div>
                    <span className={`font-semibold ${opt.type === 'call' ? 'text-green-500' : 'text-red-500'}`}>
                      {opt.type.toUpperCase()}
                    </span>
                    <span className="text-white ml-2">${opt.strike}</span>
                    <span className="text-zinc-400 ml-2 text-sm">@ ${opt.lastPrice}</span>
                  </div>
                  <button
                    onClick={() => toggleOptionSelection(opt, opt.type)}
                    className="text-red-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {results && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Strategy Analysis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Total Cost</div>
                <div className="text-xl font-bold text-white">${results.currentCost}</div>
              </div>
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Max Gain</div>
                <div className="text-xl font-bold text-green-500">${results.maxGain}</div>
              </div>
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Max Loss</div>
                <div className="text-xl font-bold text-red-500">${results.maxLoss}</div>
              </div>
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">R/R Ratio</div>
                <div className="text-xl font-bold text-orange-500">{results.rewardRiskRatio}:1</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">If Stock Rises</div>
                <div className="text-xl font-bold text-green-500">+{results.percentGain}%</div>
                <div className="text-sm text-zinc-400 mt-1">${results.profitUp}</div>
              </div>
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">If Stock Falls</div>
                <div className="text-xl font-bold text-red-500">{results.percentLoss}%</div>
                <div className="text-sm text-zinc-400 mt-1">${results.profitDown}</div>
              </div>
            </div>
          </div>
        )}

        {/* Option Chain */}
        {optionChain && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              Option Chain - Click to Select
              {strategies.find(s => s.value === selectedStrategy) && (
                <span className="text-sm text-zinc-400 ml-2">
                  (Select {strategies.find(s => s.value === selectedStrategy).legs} option{strategies.find(s => s.value === selectedStrategy).legs > 1 ? 's' : ''})
                </span>
              )}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-3 text-left font-medium text-green-500">CALLS</th>
                    <th className="px-3 py-3 text-center font-medium text-zinc-400">Strike</th>
                    <th className="px-3 py-3 text-right font-medium text-red-500">PUTS</th>
                  </tr>
                </thead>
                <tbody>
                  {optionChain.calls.map((call, idx) => {
                    const put = optionChain.puts.find(p => p.strike === call.strike);
                    const callSelected = selectedOptions.some(o => o.contractSymbol === call.contractSymbol);
                    const putSelected = put && selectedOptions.some(o => o.contractSymbol === put.contractSymbol);
                    
                    return (
                      <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800">
                        <td
                          onClick={() => toggleOptionSelection(call, 'call')}
                          className={`px-3 py-3 cursor-pointer transition ${
                            callSelected 
                              ? 'bg-green-500/20 text-green-400 font-bold' 
                              : 'text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span>${call.lastPrice.toFixed(2)}</span>
                            <span className="text-xs text-zinc-500">IV: {(call.impliedVolatility * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className={`px-3 py-3 text-center font-bold ${
                          Math.abs(call.strike - stockPrice) < stockPrice * 0.02 
                            ? 'text-orange-500' 
                            : 'text-white'
                        }`}>
                          ${call.strike}
                        </td>
                        <td
                          onClick={() => put && toggleOptionSelection(put, 'put')}
                          className={`px-3 py-3 cursor-pointer transition text-right ${
                            putSelected 
                              ? 'bg-red-500/20 text-red-400 font-bold' 
                              : 'text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {put && (
                            <div className="flex justify-between">
                              <span className="text-xs text-zinc-500">IV: {(put.impliedVolatility * 100).toFixed(0)}%</span>
                              <span>${put.lastPrice.toFixed(2)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionsAnalyzer;