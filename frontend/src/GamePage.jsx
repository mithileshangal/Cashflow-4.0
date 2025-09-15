import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const backendUrl = 'http://localhost:5000/api';

const formatCurrency = (number) => {
    const formatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    });
    return formatter.format(number);
};

const showMessage = (message, type = 'success') => {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg transition-all duration-300 transform`;
    
    if (type === 'success') {
        messageBox.classList.add('bg-green-100', 'text-green-800');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'text-red-800');
    }

    messageBox.classList.remove('translate-x-full', 'opacity-0');
    setTimeout(() => {
        messageBox.classList.add('translate-x-full', 'opacity-0');
    }, 3000);
};

const GamePage = ({ auth, setAuth }) => {
    const [teams, setTeams] = useState([]);
    const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableSmallDeals, setAvailableSmallDeals] = useState([]);
    const [availableBigDeals, setAvailableBigDeals] = useState([]);
    const [selectedDeal, setSelectedDeal] = useState(null);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
    const [loanType, setLoanType] = useState('');
    const [assetType, setAssetType] = useState('');
    const [dealType, setDealType] = useState('');

    const fetchGameState = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${backendUrl}/game/state`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            if (data.teams) {
                setTeams(data.teams);
            }
            if (data.logs) {
                setLogs(data.logs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`));
            }
        } catch (error) {
            console.error("Error fetching game state:", error);
            showMessage("Failed to load game state.", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchDeals = async (type) => {
        try {
            const { data } = await axios.get(`${backendUrl}/game/deals/${type}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            return data.deals;
        } catch (error) {
            console.error("Error fetching deals:", error);
            showMessage("Failed to load deals.", "error");
            return [];
        }
    };

    useEffect(() => {
        fetchGameState();
        const loadDeals = async () => {
            const smallDeals = await fetchDeals('small');
            const bigDeals = await fetchDeals('big');
            setAvailableSmallDeals(smallDeals);
            setAvailableBigDeals(bigDeals);
        };
        loadDeals();

        const interval = setInterval(fetchGameState, 5000);
        return () => clearInterval(interval);
    }, [auth]);

    const handleAction = async (endpoint, payload = {}) => {
        const teamId = teams[currentTeamIndex]._id;
        try {
            const { data } = await axios.post(`${backendUrl}/game/${endpoint}`, { ...payload, teamId }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            if (data.teams) {
                setTeams(data.teams);
            }
            if (data.logs) {
                setLogs(data.logs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`));
            }
            if (data.message) {
                showMessage(data.message);
            }
            if (endpoint.includes('deal')) {
                setSelectedDeal(null);
            }
        } catch (error) {
            console.error("API error:", error);
            showMessage(error.response?.data?.message || 'An error occurred.', 'error');
        }
    };

    const handleBuyDeal = async () => {
        if (!selectedDeal) return;
        setIsDealModalOpen(false);
        const dealEndpoint = dealType === 'small' ? 'deal/small' : 'deal/big';
        await handleAction(dealEndpoint, { dealId: selectedDeal._id });
    };

    const handleBuyAsset = async (name, amount, price) => {
        setIsAssetModalOpen(false);
        const endpoint = assetType === 'stock' ? 'stock' : 'crypto';
        await handleAction(endpoint, { name, amount, price });
    };

    const handleLoanAction = async (amount) => {
        setIsLoanModalOpen(false);
        const endpoint = loanType === 'borrow' ? 'loan/borrow' : 'loan/repay';
        await handleAction(endpoint, { amount });
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        setAuth(null);
    };

    const openDealModal = (type) => {
        setDealType(type);
        const deals = type === 'small' ? availableSmallDeals : availableBigDeals;
        
        const ownedDealIds = teams.flatMap(team => team.deals.map(deal => deal._id));
        const dealsToDisplay = deals.filter(deal => !ownedDealIds.includes(deal._id));

        if (dealsToDisplay.length > 0) {
            setSelectedDeal(dealsToDisplay[0]);
        } else {
            setSelectedDeal(null);
        }
        setIsDealModalOpen(true);
    };

    const openAssetModal = (type) => {
        setAssetType(type);
        setIsAssetModalOpen(true);
    };

    const openLoanModal = (type) => {
        setLoanType(type);
        setIsLoanModalOpen(true);
    };

    const teamState = teams[currentTeamIndex] || {};
    const totalLiabilities = teamState.personalLoan + teamState.smallDealLoan + teamState.bigDealLoan;
    const totalExpenses = teamState.expenses + (teamState.personalLoan * teamState.loanInterestRate);
    const totalIncome = teamState.income + teamState.passiveIncome;
    const netPayday = totalIncome - totalExpenses;

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading game data...</div>;
    }

    const dealsToDisplay = dealType === 'small' ? availableSmallDeals : availableBigDeals;

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-4 md:p-8">
            <main className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6 flex flex-col justify-between">
                    <div>
                        <div className="bg-gray-100 p-4 rounded-xl shadow-inner mb-4 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-gray-700">Username: {auth.username}</p>
                                <p className="font-bold text-gray-700">Role: {auth.role}</p>
                            </div>
                            <button onClick={handleLogout} className="py-2 px-4 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-md">Logout</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button onClick={() => handleAction('payday')} className="w-full py-4 rounded-xl font-bold text-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-md">Payday</button>
                            <button onClick={() => handleAction('roll')} className="w-full py-4 rounded-xl font-bold text-lg text-white bg-yellow-500 hover:bg-yellow-600 transition-colors shadow-md">Roll</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button onClick={() => handleAction('penalty')} className="w-full py-2 px-4 rounded-xl text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors shadow-md">Penalty</button>
                            <button onClick={() => handleAction('chance')} className="w-full py-2 px-4 rounded-xl text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors shadow-md">Chance</button>
                            
                            <button onClick={() => openDealModal('small')} className="w-full py-2 px-4 rounded-xl text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors shadow-md">Small Deal</button>
                            <button onClick={() => openDealModal('big')} className="w-full py-2 px-4 rounded-xl text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors shadow-md">Big Deal</button>

                            <button onClick={() => openAssetModal('stock')} className="w-full py-2 px-4 rounded-xl text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors shadow-md">Stock</button>
                            <button onClick={() => openAssetModal('crypto')} className="w-full py-2 px-4 rounded-xl text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors shadow-md">Crypto</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => openLoanModal('borrow')} className="w-full py-3 rounded-xl text-white font-semibold bg-green-500 hover:bg-green-600 transition-colors shadow-md">Borrow Loan</button>
                            <button onClick={() => openLoanModal('repay')} className="w-full py-3 rounded-xl text-white font-semibold bg-red-500 hover:bg-red-600 transition-colors shadow-md">Repay Loan</button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <button onClick={() => handleAction('freeze')} className="w-full py-3 rounded-xl text-white font-semibold bg-orange-500 hover:bg-orange-600 transition-colors shadow-md text-sm">Asset Freeze</button>
                            <button onClick={() => handleAction('customs')} className="w-full py-3 rounded-xl text-white font-semibold bg-orange-500 hover:bg-orange-600 transition-colors shadow-md text-sm">Custom Duty</button>
                            <button onClick={() => handleAction('bullsIsland')} className="w-full py-3 rounded-xl text-white font-semibold bg-orange-500 hover:bg-orange-600 transition-colors shadow-md text-sm">Bulls Island</button>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6">
                    <div className="grid grid-cols-3 gap-2">
                        {teams.map((team, index) => (
                            <button key={team._id} onClick={() => setCurrentTeamIndex(index)} className={`w-full py-2 rounded-xl text-white font-semibold ${currentTeamIndex === index ? 'bg-indigo-600' : 'bg-indigo-500'} hover:bg-indigo-600 transition-colors shadow-md`}>
                                {team.teamName}
                            </button>
                        ))}
                    </div>
                    <div className="bg-gray-100 p-4 rounded-xl shadow-inner">
                        <h2 className="text-xl font-bold text-center text-gray-700 mb-4">Team {teamState.teamName} Details</h2>
                        <div className="space-y-2 text-gray-600">
                            <div className="flex justify-between items-center"><span className="font-medium">Cash:</span><span className="font-bold text-lg text-green-700">{formatCurrency(teamState.cash)}</span></div>
                            <div className="flex justify-between items-center"><span className="font-medium">Income:</span><span className="font-bold text-lg text-green-700">{formatCurrency(totalIncome)}</span></div>
                            <div className="flex justify-between items-center"><span className="font-medium">Passive Income:</span><span className="font-bold text-lg text-green-700">{formatCurrency(teamState.passiveIncome)}</span></div>
                            <div className="flex justify-between items-center"><span className="font-medium">Assets:</span><span className="font-bold text-lg text-green-700">{formatCurrency(teamState.assets)}</span></div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-300 space-y-2 text-gray-600">
                            <h3 className="font-bold text-sm text-gray-800">Liabilities</h3>
                            <div className="flex justify-between items-center"><span className="font-medium text-xs">Small Deal Loan:</span><span className="text-xs">{formatCurrency(teamState.smallDealLoan)}</span></div>
                            <div className="flex justify-between items-center"><span className="font-medium text-xs">Big Deal Loan:</span><span className="text-xs">{formatCurrency(teamState.bigDealLoan)}</span></div>
                            <div className="flex justify-between items-center"><span className="font-medium text-xs">Personal Loan:</span><span className="text-xs">{formatCurrency(teamState.personalLoan)}</span></div>
                            <div className="flex justify-between items-center font-bold text-sm border-t border-gray-300 pt-2"><span className="text-red-700">Total:</span><span className="text-red-700">{formatCurrency(totalLiabilities)}</span></div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-300 space-y-2 text-gray-600">
                            <div className="flex justify-between items-center"><span className="font-medium">Expenses:</span><span className="font-bold text-lg text-red-700">{formatCurrency(totalExpenses)}</span></div>
                            <div className="flex justify-between items-center"><span className="font-medium">Payday:</span><span className="font-bold text-lg text-green-700">{formatCurrency(netPayday)}</span></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4 flex flex-col">
                    <h2 className="text-2xl font-bold text-gray-800">Table Logs</h2>
                    <div className="flex-grow bg-gray-100 p-4 rounded-xl shadow-inner text-sm text-gray-700 overflow-y-auto max-h-96">
                        {logs.length > 0 ? logs.map((log, index) => (
                            <p key={index} className="mb-2">{log}</p>
                        )) : (
                            <p className="text-center text-gray-400">No transaction history available.</p>
                        )}
                    </div>
                </div>
            </main>
            
            {isDealModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
                        <h3 className="text-2xl font-bold text-center mb-4 text-gray-800">{dealType === 'small' ? 'Small Deal' : 'Big Deal'}</h3>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Select a Deal:</label>
                            <select 
                                onChange={(e) => {
                                    const selected = dealsToDisplay.find(d => d._id === e.target.value);
                                    setSelectedDeal(selected);
                                }} 
                                className="w-full p-2 border rounded-md text-gray-700"
                                value={selectedDeal?._id || ''}
                            >
                                <option value="" disabled>-- Select a deal --</option>
                                {dealsToDisplay.map((deal) => (
                                    <option key={deal._id} value={deal._id}>{deal.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedDeal && (
                            <div className="bg-gray-100 p-4 rounded-lg mb-4 text-gray-800">
                                <p><strong>Name:</strong> {selectedDeal.name}</p>
                                <p><strong>Cost:</strong> {formatCurrency(selectedDeal.cost)}</p>
                                <p><strong>Passive Income:</strong> {formatCurrency(selectedDeal.passiveIncome)}</p>
                            </div>
                        )}
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setIsDealModalOpen(false)} className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                            <button 
                                onClick={handleBuyDeal} 
                                disabled={!selectedDeal}
                                className={`font-semibold py-2 px-4 rounded-md text-white transition-colors ${!selectedDeal ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAssetModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
                        <h3 className="text-2xl font-bold text-center mb-4 text-gray-800">Buy {assetType === 'stock' ? 'Stock' : 'Crypto'}</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const name = e.target.name.value;
                            const amount = parseInt(e.target.amount.value);
                            const price = parseFloat(e.target.price.value);
                            handleBuyAsset(name, amount, price);
                        }}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Name:</label>
                                <input type="text" name="name" className="w-full p-2 border rounded-md text-gray-700" placeholder={assetType === 'stock' ? 'e.g., AAPL' : 'e.g., BTC'} required />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Amount:</label>
                                <input type="number" name="amount" className="w-full p-2 border rounded-md text-gray-700" required min="1" />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Price:</label>
                                <input type="number" name="price" className="w-full p-2 border rounded-md text-gray-700" required min="0" />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => setIsAssetModalOpen(false)} className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-400">
                                    Cancel
                                </button>
                                <button type="submit" className="font-semibold py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                    Buy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isLoanModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
                        <h3 className="text-2xl font-bold text-center mb-4 text-gray-800">{loanType === 'borrow' ? 'Borrow Loan' : 'Repay Loan'}</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const amount = parseFloat(e.target.amount.value);
                            handleLoanAction(amount);
                        }}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Amount:</label>
                                <input type="number" name="amount" className="w-full p-2 border rounded-md text-gray-700" required min="1" />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => setIsLoanModalOpen(false)} className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-400">
                                    Cancel
                                </button>
                                <button type="submit" className="font-semibold py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                    {loanType === 'borrow' ? 'Borrow' : 'Repay'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamePage;