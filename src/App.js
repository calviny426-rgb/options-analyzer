import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Layers, ChevronDown, ChevronUp } from 'lucide-react';

const OptionsAnalyzer = () => {
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockPrice, setStockPrice] = useState(25.50);
  const [volatility, setVolatility] = useState(35);
  const [daysToExpiration, setDaysToExpiration] = useState(30);
  const [strikes, setStrikes] = useState([20, 22.5, 25, 27.5, 30]);
  const [callPrices, setCallPrices] = useState([5.80, 3.50, 1.80, 0.60, 0.15]);
  const [putPrices, setPutPrices] = useState([0.10, 0.30, 1.50, 3.40, 5.60]);
  const [selectedStrategy, setSelectedStrategy] = useState('call');
  const [results, setResults] = useState(null);
  const [expandedSection, setExpandedSection] = useState('inputs');

  const strategies = [
    { value: 'call', label: 'Long Call', type: 'single' },
    { value: 'put', label: 'Long Put', type: 'single' },
    { value: 'vertical_call_spread', label: 'Bull Call Spread', type: 'spread' },
    { value: 'vertical_put_spread', label: 'Bear Put Spread', type: 'spread' },
    { value: 'iron_condor', label: 'Iron Condor', type: 'advanced' },
    { value: 'butterfly', label: 'Long Call Butterfly', type: 'advanced' },
    { value: 'put_butterfly', label: 'Long Put Butterfly', type: 'advanced' },
    { value: 'straddle', label: 'Long Straddle', type: 'volatility' },
    { value: 'strangle', label: 'Long Strangle', type: 'volatility' },
  ];

  const blackScholesCall = (S, K, T, r, sigma) => {
    if (T <= 0) return Math.max(0, S - K);
    
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const normCdf = (x) => {
      const t = 1 / (1 + 0.2316419 * Math.abs(x));
      const d = 0.3989423 * Math.exp(-x * x / 2);
      const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      return x > 0 ? 1 - prob : prob;
    };
    
    return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  };

  const blackScholesPut = (S, K, T, r, sigma) => {
    if (T <= 0) return Math.max(0, K - S);
    
    const callPrice = blackScholesCall(S, K, T, r, sigma);
    return callPrice - S + K * Math.exp(-r * T);
  };

  const calculateSingleOption = (isCall) => {
    const T = daysToExpiration / 365;
    const r = 0.05;
    const sigma = volatility / 100;
    
    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);
    
    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);
    
    const prices = isCall ? callPrices : putPrices;
    const calcFunc = isCall ? blackScholesCall : blackScholesPut;
    
    const analysisResults = strikes.map((strike, idx) => {
      const currentPrice = prices[idx];
      
      const priceAfterUp = calcFunc(stockUp, strike, T * 0.5, r, sigma);
      const priceAfterDown = calcFunc(stockDown, strike, T * 0.5, r, sigma);
      
      const percentGain = ((priceAfterUp - currentPrice) / currentPrice) * 100;
      const percentLoss = ((priceAfterDown - currentPrice) / currentPrice) * 100;
      const rewardRiskRatio = percentLoss !== 0 ? Math.abs(percentGain / percentLoss) : 0;
      
      return {
        strike,
        currentPrice: currentPrice.toFixed(2),
        stockUp: stockUp.toFixed(2),
        stockDown: stockDown.toFixed(2),
        priceAfterUp: priceAfterUp.toFixed(2),
        priceAfterDown: priceAfterDown.toFixed(2),
        percentGain: percentGain.toFixed(1),
        percentLoss: percentLoss.toFixed(1),
        rewardRiskRatio: rewardRiskRatio.toFixed(2),
        maxGain: 'Unlimited',
        maxLoss: currentPrice.toFixed(2)
      };
    });
    
    const sortedByReward = [...analysisResults].sort((a, b) => 
      parseFloat(b.percentGain) - parseFloat(a.percentGain)
    );
    
    const sortedByRatio = [...analysisResults].sort((a, b) => 
      parseFloat(b.rewardRiskRatio) - parseFloat(a.rewardRiskRatio)
    );
    
    return {
      all: analysisResults,
      byReward: sortedByReward,
      byRatio: sortedByRatio
    };
  };

  const calculateVerticalSpread = (isCallSpread) => {
    const T = daysToExpiration / 365;
    const r = 0.05;
    const sigma = volatility / 100;
    
    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);
    
    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);
    
    const results = [];
    
    for (let i = 0; i < strikes.length - 1; i++) {
      for (let j = i + 1; j < strikes.length; j++) {
        const longStrike = strikes[i];
        const shortStrike = strikes[j];
        
        let netDebit, maxGain, maxLoss;
        
        if (isCallSpread) {
          const longCallPrice = callPrices[i];
          const shortCallPrice = callPrices[j];
          netDebit = longCallPrice - shortCallPrice;
          maxGain = (shortStrike - longStrike) - netDebit;
          maxLoss = netDebit;
          
          const longCallUp = blackScholesCall(stockUp, longStrike, T * 0.5, r, sigma);
          const shortCallUp = blackScholesCall(stockUp, shortStrike, T * 0.5, r, sigma);
          const spreadValueUp = longCallUp - shortCallUp;
          
          const longCallDown = blackScholesCall(stockDown, longStrike, T * 0.5, r, sigma);
          const shortCallDown = blackScholesCall(stockDown, shortStrike, T * 0.5, r, sigma);
          const spreadValueDown = longCallDown - shortCallDown;
          
          const profitUp = spreadValueUp - netDebit;
          const profitDown = spreadValueDown - netDebit;
          
          const percentGain = (profitUp / netDebit) * 100;
          const percentLoss = (profitDown / netDebit) * 100;
          
          results.push({
            description: `Buy ${longStrike} / Sell ${shortStrike} Call`,
            longStrike,
            shortStrike,
            netDebit: netDebit.toFixed(2),
            maxGain: maxGain.toFixed(2),
            maxLoss: maxLoss.toFixed(2),
            percentGain: percentGain.toFixed(1),
            percentLoss: percentLoss.toFixed(1),
            rewardRiskRatio: (maxGain / maxLoss).toFixed(2),
          });
        } else {
          const longPutPrice = putPrices[j];
          const shortPutPrice = putPrices[i];
          netDebit = longPutPrice - shortPutPrice;
          maxGain = (shortStrike - longStrike) - netDebit;
          maxLoss = netDebit;
          
          const longPutDown = blackScholesPut(stockDown, shortStrike, T * 0.5, r, sigma);
          const shortPutDown = blackScholesPut(stockDown, longStrike, T * 0.5, r, sigma);
          const spreadValueDown = longPutDown - shortPutDown;
          
          const longPutUp = blackScholesPut(stockUp, shortStrike, T * 0.5, r, sigma);
          const shortPutUp = blackScholesPut(stockUp, longStrike, T * 0.5, r, sigma);
          const spreadValueUp = longPutUp - shortPutUp;
          
          const profitDown = spreadValueDown - netDebit;
          const profitUp = spreadValueUp - netDebit;
          
          const percentGain = (profitDown / netDebit) * 100;
          const percentLoss = (profitUp / netDebit) * 100;
          
          results.push({
            description: `Buy ${shortStrike} / Sell ${longStrike} Put`,
            longStrike: shortStrike,
            shortStrike: longStrike,
            netDebit: netDebit.toFixed(2),
            maxGain: maxGain.toFixed(2),
            maxLoss: maxLoss.toFixed(2),
            percentGain: percentGain.toFixed(1),
            percentLoss: percentLoss.toFixed(1),
            rewardRiskRatio: (maxGain / maxLoss).toFixed(2),
          });
        }
      }
    }
    
    const sortedByReward = [...results].sort((a, b) => 
      parseFloat(b.percentGain) - parseFloat(a.percentGain)
    );
    
    const sortedByRatio = [...results].sort((a, b) => 
      parseFloat(b.rewardRiskRatio) - parseFloat(a.rewardRiskRatio)
    );
    
    return {
      all: results,
      byReward: sortedByReward,
      byRatio: sortedByRatio
    };
  };

  const calculateButterfly = (isCall) => {
    const T = daysToExpiration / 365;
    const r = 0.05;
    const sigma = volatility / 100;
    
    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);
    
    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);
    
    const results = [];
    
    for (let i = 0; i < strikes.length - 2; i++) {
      for (let j = i + 1; j < strikes.length - 1; j++) {
        for (let k = j + 1; k < strikes.length; k++) {
          const lowerStrike = strikes[i];
          const middleStrike = strikes[j];
          const upperStrike = strikes[k];
          
          if ((middleStrike - lowerStrike) !== (upperStrike - middleStrike)) continue;
          
          let netDebit, maxGain;
          
          if (isCall) {
            const lowerCallPrice = callPrices[i];
            const middleCallPrice = callPrices[j];
            const upperCallPrice = callPrices[k];
            
            netDebit = lowerCallPrice - (2 * middleCallPrice) + upperCallPrice;
            maxGain = (middleStrike - lowerStrike) - netDebit;
            
            const lowerCallUp = blackScholesCall(stockUp, lowerStrike, T * 0.5, r, sigma);
            const middleCallUp = blackScholesCall(stockUp, middleStrike, T * 0.5, r, sigma);
            const upperCallUp = blackScholesCall(stockUp, upperStrike, T * 0.5, r, sigma);
            const butterflyValueUp = lowerCallUp - (2 * middleCallUp) + upperCallUp;
            
            const lowerCallDown = blackScholesCall(stockDown, lowerStrike, T * 0.5, r, sigma);
            const middleCallDown = blackScholesCall(stockDown, middleStrike, T * 0.5, r, sigma);
            const upperCallDown = blackScholesCall(stockDown, upperStrike, T * 0.5, r, sigma);
            const butterflyValueDown = lowerCallDown - (2 * middleCallDown) + upperCallDown;
            
            const profitUp = butterflyValueUp - netDebit;
            const profitDown = butterflyValueDown - netDebit;
            
            const percentGain = netDebit > 0 ? (profitUp / netDebit) * 100 : 0;
            const percentLoss = netDebit > 0 ? (profitDown / netDebit) * 100 : 0;
            
            results.push({
              description: `${lowerStrike}/${middleStrike}/${upperStrike} Call Butterfly`,
              strikes: `${lowerStrike}/${middleStrike}/${upperStrike}`,
              netDebit: netDebit.toFixed(2),
              maxGain: maxGain.toFixed(2),
              maxLoss: netDebit.toFixed(2),
              percentGain: percentGain.toFixed(1),
              percentLoss: percentLoss.toFixed(1),
              rewardRiskRatio: netDebit > 0 ? (maxGain / netDebit).toFixed(2) : '0.00',
            });
          } else {
            const lowerPutPrice = putPrices[i];
            const middlePutPrice = putPrices[j];
            const upperPutPrice = putPrices[k];
            
            netDebit = upperPutPrice - (2 * middlePutPrice) + lowerPutPrice;
            maxGain = (middleStrike - lowerStrike) - netDebit;
            
            const lowerPutUp = blackScholesPut(stockUp, lowerStrike, T * 0.5, r, sigma);
            const middlePutUp = blackScholesPut(stockUp, middleStrike, T * 0.5, r, sigma);
            const upperPutUp = blackScholesPut(stockUp, upperStrike, T * 0.5, r, sigma);
            const butterflyValueUp = upperPutUp - (2 * middlePutUp) + lowerPutUp;
            
            const lowerPutDown = blackScholesPut(stockDown, lowerStrike, T * 0.5, r, sigma);
            const middlePutDown = blackScholesPut(stockDown, middleStrike, T * 0.5, r, sigma);
            const upperPutDown = blackScholesPut(stockDown, upperStrike, T * 0.5, r, sigma);
            const butterflyValueDown = upperPutDown - (2 * middlePutDown) + lowerPutDown;
            
            const profitUp = butterflyValueUp - netDebit;
            const profitDown = butterflyValueDown - netDebit;
            
            const percentGain = netDebit > 0 ? (profitUp / netDebit) * 100 : 0;
            const percentLoss = netDebit > 0 ? (profitDown / netDebit) * 100 : 0;
            
            results.push({
              description: `${lowerStrike}/${middleStrike}/${upperStrike} Put Butterfly`,
              strikes: `${lowerStrike}/${middleStrike}/${upperStrike}`,
              netDebit: netDebit.toFixed(2),
              maxGain: maxGain.toFixed(2),
              maxLoss: netDebit.toFixed(2),
              percentGain: percentGain.toFixed(1),
              percentLoss: percentLoss.toFixed(1),
              rewardRiskRatio: netDebit > 0 ? (maxGain / netDebit).toFixed(2) : '0.00',
            });
          }
        }
      }
    }
    
    const sortedByReward = [...results].sort((a, b) => 
      parseFloat(b.percentGain) - parseFloat(a.percentGain)
    );
    
    const sortedByRatio = [...results].sort((a, b) => 
      parseFloat(b.rewardRiskRatio) - parseFloat(a.rewardRiskRatio)
    );
    
    return {
      all: results,
      byReward: sortedByReward,
      byRatio: sortedByRatio
    };
  };

  const calculateIronCondor = () => {
    const T = daysToExpiration / 365;
    const r = 0.05;
    const sigma = volatility / 100;
    
    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);
    
    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);
    
    const results = [];
    
    for (let i = 0; i < strikes.length - 3; i++) {
      for (let j = i + 1; j < strikes.length - 2; j++) {
        for (let k = j + 1; k < strikes.length - 1; k++) {
          for (let l = k + 1; l < strikes.length; l++) {
            const putLong = strikes[i];
            const putShort = strikes[j];
            const callShort = strikes[k];
            const callLong = strikes[l];
            
            const netCredit = (putPrices[j] - putPrices[i]) + (callPrices[k] - callPrices[l]);
            const maxLoss = Math.min(putShort - putLong, callLong - callShort) - netCredit;
            
            const putLongDown = blackScholesPut(stockDown, putLong, T * 0.5, r, sigma);
            const putShortDown = blackScholesPut(stockDown, putShort, T * 0.5, r, sigma);
            const callShortDown = blackScholesCall(stockDown, callShort, T * 0.5, r, sigma);
            const callLongDown = blackScholesCall(stockDown, callLong, T * 0.5, r, sigma);
            
            const condorValueDown = (putShortDown - putLongDown) + (callShortDown - callLongDown);
            const profitDown = netCredit - condorValueDown;
            
            const putLongUp = blackScholesPut(stockUp, putLong, T * 0.5, r, sigma);
            const putShortUp = blackScholesPut(stockUp, putShort, T * 0.5, r, sigma);
            const callShortUp = blackScholesCall(stockUp, callShort, T * 0.5, r, sigma);
            const callLongUp = blackScholesCall(stockUp, callLong, T * 0.5, r, sigma);
            
            const condorValueUp = (putShortUp - putLongUp) + (callShortUp - callLongUp);
            const profitUp = netCredit - condorValueUp;
            
            const percentGain = maxLoss > 0 ? (netCredit / maxLoss) * 100 : 0;
            const worstProfit = Math.min(profitUp, profitDown);
            const percentLoss = maxLoss > 0 ? (worstProfit / maxLoss) * 100 : 0;
            
            results.push({
              description: `${putLong}/${putShort}/${callShort}/${callLong} Iron Condor`,
              strikes: `${putLong}/${putShort}/${callShort}/${callLong}`,
              netCredit: netCredit.toFixed(2),
              maxGain: netCredit.toFixed(2),
              maxLoss: maxLoss.toFixed(2),
              percentGain: percentGain.toFixed(1),
              percentLoss: percentLoss.toFixed(1),
              rewardRiskRatio: maxLoss > 0 ? (netCredit / maxLoss).toFixed(2) : '0.00',
            });
          }
        }
      }
    }
    
    const sortedByReward = [...results].sort((a, b) => 
      parseFloat(b.percentGain) - parseFloat(a.percentGain)
    );
    
    const sortedByRatio = [...results].sort((a, b) => 
      parseFloat(b.rewardRiskRatio) - parseFloat(a.rewardRiskRatio)
    );
    
    return {
      all: results.slice(0, 20),
      byReward: sortedByReward.slice(0, 5),
      byRatio: sortedByRatio.slice(0, 5)
    };
  };

  const calculateStraddle = () => {
    const T = daysToExpiration / 365;
    const r = 0.05;
    const sigma = volatility / 100;
    
    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);
    
    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);
    
    const results = strikes.map((strike, idx) => {
      const totalCost = callPrices[idx] + putPrices[idx];
      
      const callUp = blackScholesCall(stockUp, strike, T * 0.5, r, sigma);
      const putUp = blackScholesPut(stockUp, strike, T * 0.5, r, sigma);
      const valueUp = callUp + putUp;
      
      const callDown = blackScholesCall(stockDown, strike, T * 0.5, r, sigma);
      const putDown = blackScholesPut(stockDown, strike, T * 0.5, r, sigma);
      const valueDown = callDown + putDown;
      
      const profitUp = valueUp - totalCost;
      const profitDown = valueDown - totalCost;
      const maxProfit = Math.max(profitUp, profitDown);
      
      const percentGain = (maxProfit / totalCost) * 100;
      const minProfit = Math.min(profitUp, profitDown);
      const percentLoss = (minProfit / totalCost) * 100;
      
      return {
        description: `${strike} Straddle`,
        strike,
        totalCost: totalCost.toFixed(2),
        maxGain: 'Unlimited',
        maxLoss: totalCost.toFixed(2),
        percentGain: percentGain.toFixed(1),
        percentLoss: percentLoss.toFixed(1),
        rewardRiskRatio: (maxProfit / totalCost).toFixed(2),
      };
    });
    
    const sortedByReward = [...results].sort((a, b) => 
      parseFloat(b.percentGain) - parseFloat(a.percentGain)
    );
    
    const sortedByRatio = [...results].sort((a, b) => 
      parseFloat(b.rewardRiskRatio) - parseFloat(a.rewardRiskRatio)
    );
    
    return {
      all: results,
      byReward: sortedByReward,
      byRatio: sortedByRatio
    };
  };

  const calculateStrangle = () => {
    const T = daysToExpiration / 365;
    const r = 0.05;
    const sigma = volatility / 100;
    
    const upMove = sigma * Math.sqrt(T);
    const downMove = sigma * Math.sqrt(T);
    
    const stockUp = stockPrice * Math.exp(upMove);
    const stockDown = stockPrice * Math.exp(-downMove);
    
    const results = [];
    
    for (let i = 0; i < strikes.length - 1; i++) {
      for (let j = i + 1; j < strikes.length; j++) {
        const putStrike = strikes[i];
        const callStrike = strikes[j];
        
        const totalCost = putPrices[i] + callPrices[j];
        
        const callUp = blackScholesCall(stockUp, callStrike, T * 0.5, r, sigma);
        const putUp = blackScholesPut(stockUp, putStrike, T * 0.5, r, sigma);
        const valueUp = callUp + putUp;
        
        const callDown = blackScholesCall(stockDown, callStrike, T * 0.5, r, sigma);
        const putDown = blackScholesPut(stockDown, putStrike, T * 0.5, r, sigma);
        const valueDown = callDown + putDown;
        
        const profitUp = valueUp - totalCost;
        const profitDown = valueDown - totalCost;
        const maxProfit = Math.max(profitUp, profitDown);
        
        const percentGain = (maxProfit / totalCost) * 100;
        const minProfit = Math.min(profitUp, profitDown);
        const percentLoss = (minProfit / totalCost) * 100;
        
        results.push({
          description: `${putStrike}/${callStrike} Strangle`,
          strikes: `${putStrike}/${callStrike}`,
          totalCost: totalCost.toFixed(2),
          maxGain: 'Unlimited',
          maxLoss: totalCost.toFixed(2),
          percentGain: percentGain.toFixed(1),
          percentLoss: percentLoss.toFixed(1),
          rewardRiskRatio: (maxProfit / totalCost).toFixed(2),
        });
      }
    }
    
    const sortedByReward = [...results].sort((a, b) => 
      parseFloat(b.percentGain) - parseFloat(a.percentGain)
    );
    
    const sortedByRatio = [...results].sort((a, b) => 
      parseFloat(b.rewardRiskRatio) - parseFloat(a.rewardRiskRatio)
    );
    
    return {
      all: results.slice(0, 15),
      byReward: sortedByReward.slice(0, 5),
      byRatio: sortedByRatio.slice(0, 5)
    };
  };

  const calculateResults = () => {
    switch(selectedStrategy) {
      case 'call':
        return calculateSingleOption(true);
      case 'put':
        return calculateSingleOption(false);
      case 'vertical_call_spread':
        return calculateVerticalSpread(true);
      case 'vertical_put_spread':
        return calculateVerticalSpread(false);
      case 'butterfly':
        return calculateButterfly(true);
      case 'put_butterfly':
        return calculateButterfly(false);
      case 'iron_condor':
        return calculateIronCondor();
      case 'straddle':
        return calculateStraddle();
      case 'strangle':
        return calculateStrangle();
      default:
        return calculateSingleOption(true);
    }
  };

  useEffect(() => {
    const newResults = calculateResults();
    setResults(newResults);
  }, [stockPrice, volatility, daysToExpiration, strikes, callPrices, putPrices, selectedStrategy]);

  const addStrike = () => {
    setStrikes([...strikes, strikes[strikes.length - 1] + 2.5]);
    setCallPrices([...callPrices, 0.10]);
    setPutPrices([...putPrices, 0.10]);
  };

  const updateStrike = (idx, value) => {
    const newStrikes = [...strikes];
    newStrikes[idx] = parseFloat(value);
    setStrikes(newStrikes);
  };

  const updateCallPrice = (idx, value) => {
    const newPrices = [...callPrices];
    newPrices[idx] = parseFloat(value);
    setCallPrices(newPrices);
  };

  const updatePutPrice = (idx, value) => {
    const newPrices = [...putPrices];
    newPrices[idx] = parseFloat(value);
    setPutPrices(newPrices);
  };

  const removeStrike = (idx) => {
    if (strikes.length > 1) {
      setStrikes(strikes.filter((_, i) => i !== idx));
      setCallPrices(callPrices.filter((_, i) => i !== idx));
      setPutPrices(putPrices.filter((_, i) => i !== idx));
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Advanced Options Analyzer</h1>
              <p className="text-slate-600">Professional-grade options strategy analysis and ranking</p>
            </div>
            <Layers className="text-blue-600" size={48} />
          </div>
          
          <div 
            className="bg-slate-50 rounded-lg p-4 mb-6 cursor-pointer hover:bg-slate-100 transition"
            onClick={() => toggleSection('inputs')}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Market Inputs</h2>
              {expandedSection === 'inputs' ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>

          {expandedSection === 'inputs' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Stock Symbol (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., AAPL"
                    value={stockSymbol}
                    onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Current Stock Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={stockPrice}
                    onChange={(e) => setStockPrice(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Implied Volatility (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={volatility}
                    onChange={(e) => setVolatility(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Days to Expiration
                  </label>
                  <select
                    value={daysToExpiration}
                    onChange={(e) => setDaysToExpiration(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800">Strike Prices & Option Premiums</h2>
                  <button
                    onClick={addStrike}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    + Add Strike
                  </button>
                </div>
                
                <div className="grid gap-3">
                  <div className="grid grid-cols-4 gap-3 text-sm font-semibold text-slate-600 px-2">
                    <div>Strike Price</div>
                    <div>Call Premium</div>
                    <div>Put Premium</div>
                    <div>Action</div>
                  </div>
                  {strikes.map((strike, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-3">
                      <input
                        type="number"
                        step="0.5"
                        value={strike}
                        onChange={(e) => updateStrike(idx, e.target.value)}
                        className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={callPrices[idx]}
                        onChange={(e) => updateCallPrice(idx, e.target.value)}
                        className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={putPrices[idx]}
                        onChange={(e) => updatePutPrice(idx, e.target.value)}
                        className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => removeStrike(idx)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Select Strategy
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {strategies.map((strategy) => (
                <button
                  key={strategy.value}
                  onClick={() => setSelectedStrategy(strategy.value)}
                  className={`px-4 py-3 rounded-lg font-semibold transition ${
                    selectedStrategy === strategy.value
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {strategy.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {results && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-xl p-6">
                <div className="flex items-center mb-4">
                  <TrendingUp className="text-green-600 mr-2" size={24} />
                  <h2 className="text-2xl font-bold text-slate-800">Best Reward Opportunities</h2>
                </div>
                <p className="text-sm text-slate-600 mb-4">Highest percentage gain potential</p>
                
                <div className="space-y-3">
                  {results.byReward.slice(0, 3).map((result, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-l-4 border-green-500">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-lg font-bold text-slate-800">
                            {result.description || `${result.strike} ${selectedStrategy === 'put' ? 'Put' : 'Call'}`}
                          </span>
                        </div>
                        <span className="text-xl font-bold text-green-600">+{result.percentGain}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div>
                          <span className="text-slate-600">Cost:</span>
                          <span className="font-semibold ml-1">
                            ${result.currentPrice || result.netDebit || result.totalCost}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Max Gain:</span>
                          <span className="font-semibold ml-1">
                            ${result.maxGain}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-xl p-6">
                <div className="flex items-center mb-4">
                  <DollarSign className="text-blue-600 mr-2" size={24} />
                  <h2 className="text-2xl font-bold text-slate-800">Best Risk-Adjusted Returns</h2>
                </div>
                <p className="text-sm text-slate-600 mb-4">Optimal reward to risk ratios</p>
                
                <div className="space-y-3">
                  {results.byRatio.slice(0, 3).map((result, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-l-4 border-blue-500">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-lg font-bold text-slate-800">
                            {result.description || `${result.strike} ${selectedStrategy === 'put' ? 'Put' : 'Call'}`}
                          </span>
                        </div>
                        <span className="text-xl font-bold text-blue-600">{result.rewardRiskRatio}:1</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div>
                          <span className="text-slate-600">Upside:</span>
                          <span className="font-semibold text-green-600 ml-1">+{result.percentGain}%</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Downside:</span>
                          <span className="font-semibold text-red-600 ml-1">{result.percentLoss}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Complete Analysis</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Strategy</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Cost/Credit</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Max Gain</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Max Loss</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">% Gain</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">% Loss</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">R/R Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.all.map((result, idx) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold">
                          {result.description || `${result.strike}`}
                        </td>
                        <td className="px-4 py-3">
                          ${result.currentPrice || result.netDebit || result.netCredit || result.totalCost}
                        </td>
                        <td className="px-4 py-3 text-green-600 font-semibold">
                          ${result.maxGain}
                        </td>
                        <td className="px-4 py-3 text-red-600 font-semibold">
                          ${result.maxLoss}
                        </td>
                        <td className="px-4 py-3 font-semibold text-green-600">+{result.percentGain}%</td>
                        <td className="px-4 py-3 font-semibold text-red-600">{result.percentLoss}%</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{result.rewardRiskRatio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mt-6">
              <h3 className="text-lg font-bold text-slate-800 mb-3">Strategy Notes</h3>
              <div className="text-sm text-slate-700 space-y-2">
                {selectedStrategy === 'call' && (
                  <p><strong>Long Call:</strong> Unlimited profit potential with limited risk. Best for bullish outlook with defined risk.</p>
                )}
                {selectedStrategy === 'put' && (
                  <p><strong>Long Put:</strong> Profits from downside movement with limited risk. Best for bearish outlook with defined risk.</p>
                )}
                {selectedStrategy === 'vertical_call_spread' && (
                  <p><strong>Bull Call Spread:</strong> Limited profit and loss. Lower cost than buying calls outright. Best for moderately bullish outlook.</p>
                )}
                {selectedStrategy === 'vertical_put_spread' && (
                  <p><strong>Bear Put Spread:</strong> Limited profit and loss. Lower cost than buying puts outright. Best for moderately bearish outlook.</p>
                )}
                {selectedStrategy === 'butterfly' && (
                  <p><strong>Long Call Butterfly:</strong> Low-cost, limited risk strategy that profits from minimal price movement. Best when expecting low volatility near the middle strike.</p>
                )}
                {selectedStrategy === 'put_butterfly' && (
                  <p><strong>Long Put Butterfly:</strong> Similar to call butterfly but constructed with puts. Profits from stock staying near middle strike at expiration.</p>
                )}
                {selectedStrategy === 'iron_condor' && (
                  <p><strong>Iron Condor:</strong> Credit strategy profiting from low volatility. Collects premium if stock stays within a range. Limited profit and loss.</p>
                )}
                {selectedStrategy === 'straddle' && (
                  <p><strong>Long Straddle:</strong> Profits from large moves in either direction. Best when expecting high volatility but uncertain about direction.</p>
                )}
                {selectedStrategy === 'strangle' && (
                  <p><strong>Long Strangle:</strong> Similar to straddle but with different strikes. Lower cost but requires larger moves to profit. Best for volatile markets.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OptionsAnalyzer;