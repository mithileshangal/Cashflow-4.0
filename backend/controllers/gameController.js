const mongoose = require('mongoose');
const Team = require('../models/Team');
const Deal = require('../models/Deal');
const TableLog = require('../models/TableLog');

const addLogEntry = async (tableId, message) => {
    try {
        await TableLog.create({ tableId, message });
    } catch (error) {
        console.error("Error saving log to database:", error);
    }
};

exports.getGameState = async (req, res) => {
  try {
    const teams = await Team.find({ tableId: req.user._id }).populate('deals');
    const logs = await TableLog.find({ tableId: req.user._id }).sort({ timestamp: -1 });
    res.json({ teams, logs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDeals = async (req, res) => {
    try {
        const { type } = req.params;
        const deals = await Deal.find({ dealType: type });
        res.json({ deals });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handlePayday = async (req, res) => {
  try {
    const { teamId } = req.body;
    const teamState = await Team.findById(teamId);

    if (!teamState) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const totalIncome = teamState.income + teamState.passiveIncome;
    const totalExpenses = teamState.expenses + (teamState.personalLoan * teamState.loanInterestRate) + (teamState.smallDealLoan * 0.05) + (teamState.bigDealLoan * 0.10);

    if (teamState.isAssetsFrozen) {
        if (teamState.paydayFrozenTurn === 0) {
            if (totalExpenses > teamState.cash) {
                const loanNeeded = teamState.assets;
                teamState.personalLoan += loanNeeded;
                teamState.cash += loanNeeded;
                addLogEntry(teamState.tableId, `Team ${teamState.teamName}: Assets are frozen. Expenses exceed cash. Forced to take a loan of ${loanNeeded} to cover expenses.`);
            }
            teamState.cash -= totalExpenses;
            teamState.paydayFrozenTurn = 1;
            addLogEntry(teamState.tableId, `Team ${teamState.teamName}: Assets are frozen. Payday income is zero. Expenses have been deducted.`);
        } else {
            teamState.isAssetsFrozen = false;
            teamState.paydayFrozenTurn = 0;
            const netPaydayIncome = totalIncome - totalExpenses;
            teamState.cash += netPaydayIncome;
            addLogEntry(teamState.tableId, `Team ${teamState.teamName}: Assets are no longer frozen. Your net payday is ${netPaydayIncome}.`);
        }
    } else {
        const netPaydayIncome = totalIncome - totalExpenses;
        teamState.cash += netPaydayIncome;
        addLogEntry(teamState.tableId, `Team ${teamState.teamName}: You received a net payday of ${netPaydayIncome}.`);
    }
    
    if (teamState.cash < 0) {
      const loanNeeded = Math.abs(teamState.cash);
      teamState.personalLoan += loanNeeded;
      teamState.cash = 0;
    }

    await teamState.save();
    
    const allTeams = await Team.find({ tableId: teamState.tableId }).populate('deals');
    const logs = await TableLog.find({ tableId: teamState.tableId }).sort({ timestamp: -1 });
    res.status(200).json({ teams: allTeams, logs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.handleRoll = async (req, res) => {
  try {
    const { teamId } = req.body;
    const teamState = await Team.findById(teamId);
    if (!teamState) return res.status(404).json({ message: 'Team not found' });
    
    const rollResult = Math.floor(Math.random() * 6) + 1;
    const events = ['Chance', 'Small Deal', 'Big Deal', 'Stock', 'Crypto', 'Payday'];
    const event = events[rollResult - 1];
    
    addLogEntry(teamState.tableId, `Team ${teamState.teamName} rolled a ${rollResult}. Landing on: ${event}.`);
    
    const allTeams = await Team.find({ tableId: teamState.tableId }).populate('deals');
    const logs = await TableLog.find({ tableId: teamState.tableId }).sort({ timestamp: -1 });
    res.json({ teams: allTeams, event, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.handleSmallDeal = async (req, res) => {
  try {
    const { teamId, dealId } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (team.isAssetsFrozen) {
      return res.status(403).json({ message: 'Assets are frozen. Cannot buy deals.' });
    }

    const universalDeal = await Deal.findById(dealId);
    if (!universalDeal) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    
    const dealAlreadyOwned = universalDeal.owners.some(owner => owner.tableId.toString() === team.tableId.toString());

    if (dealAlreadyOwned) {
      return res.status(409).json({ message: 'This deal is already owned by a team on this table.' });
    }
    
    if (team.cash < universalDeal.cost) {
      return res.status(400).json({ message: 'Not enough cash to buy this deal.' });
    }

    universalDeal.owners.push({ tableId: team.tableId, teamId: team._id });
    await universalDeal.save();
    
    team.cash -= universalDeal.cost;
    team.passiveIncome += universalDeal.passiveIncome;
    team.assets += universalDeal.cost;
    team.deals.push(universalDeal._id);
    await team.save();

    addLogEntry(team.tableId, `Team ${team.teamName} purchased "${universalDeal.name}" for ${universalDeal.cost}.`);

    const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
    const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
    res.status(200).json({ teams: allTeams, logs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.handleBigDeal = async (req, res) => {
  try {
    const { teamId, dealId } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (team.isAssetsFrozen) {
      return res.status(403).json({ message: 'Assets are frozen. Cannot buy deals.' });
    }

    const universalDeal = await Deal.findById(dealId);
    if (!universalDeal) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    
    const dealAlreadyOwned = universalDeal.owners.some(owner => owner.tableId.toString() === team.tableId.toString());

    if (dealAlreadyOwned) {
      return res.status(409).json({ message: 'This deal is already owned by a team on this table.' });
    }

    if (team.cash < universalDeal.cost) {
      return res.status(400).json({ message: 'Not enough cash to buy this deal.' });
    }

    universalDeal.owners.push({ tableId: team.tableId, teamId: team._id });
    await universalDeal.save();
    
    team.cash -= universalDeal.cost;
    team.passiveIncome += universalDeal.passiveIncome;
    team.assets += universalDeal.cost;
    team.deals.push(universalDeal._id);
    await team.save();

    addLogEntry(team.tableId, `Team ${team.teamName} purchased "${universalDeal.name}" for ${universalDeal.cost}.`);

    const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
    const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
    res.status(200).json({ teams: allTeams, logs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.handleBuyStock = async (req, res) => {
    try {
        const { teamId, name, amount, price } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        if (team.isAssetsFrozen) {
            return res.status(403).json({ message: 'Assets are frozen. Cannot buy stocks.' });
        }

        const totalCost = price * amount;
        if (totalCost > team.cash + team.personalLoan) {
             return res.status(400).json({ message: 'Not enough funds to buy this stock.' });
        }
        
        team.cash -= totalCost;
        if (team.cash < 0) {
            team.personalLoan += Math.abs(team.cash);
            team.cash = 0;
        }

        const newStock = {
            name,
            amount,
            purchasePrice: price,
        };
        
        team.assets += totalCost;
        team.stocks.push(newStock);
        await team.save();

        addLogEntry(team.tableId, `Team ${team.teamName} bought ${amount} units of ${name} stock for ${totalCost}.`);

        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handleBuyCrypto = async (req, res) => {
    try {
        const { teamId, name, amount, price } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        if (team.isAssetsFrozen) {
            return res.status(403).json({ message: 'Assets are frozen. Cannot buy crypto.' });
        }

        const totalCost = price * amount;
        if (totalCost > team.cash + team.personalLoan) {
            return res.status(400).json({ message: 'Not enough funds to buy this crypto.' });
        }

        team.cash -= totalCost;
        if (team.cash < 0) {
            team.personalLoan += Math.abs(team.cash);
            team.cash = 0;
        }

        const newCrypto = {
            name,
            amount,
            purchasePrice: price,
        };
        
        team.assets += totalCost;
        team.crypto.push(newCrypto);
        await team.save();
        
        addLogEntry(team.tableId, `Team ${team.teamName} bought ${amount} units of ${name} crypto for ${totalCost}.`);

        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handleAssetFreeze = async (req, res) => {
    try {
        const { teamId } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });
        
        team.isAssetsFrozen = true;
        team.paydayFrozenTurn = 0;
        await team.save();

        addLogEntry(team.tableId, `Team ${team.teamName} has had their assets frozen.`);
        
        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handlePenalty = async (req, res) => {
    try {
        const { teamId } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });
        
        team.cash -= 10000;
        await team.save();

        addLogEntry(team.tableId, `Team ${team.teamName} paid a penalty of 10,000.`);

        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handleChance = async (req, res) => {
    try {
        const { teamId } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });
        
        const chanceCards = [
            { title: "Bonus!", effect: () => { team.cash += 50000; } },
            { title: "Penalty", effect: () => { team.cash -= 20000; } },
        ];
        const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];
        
        card.effect();
        await team.save();
        
        addLogEntry(team.tableId, `Team ${team.teamName} drew a Chance card: "${card.title}"`);
        
        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs, message: `You drew a Chance card: "${card.title}"` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handleBorrowLoan = async (req, res) => {
    try {
        const { teamId, amount } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });
        
        const loanAmount = parseFloat(amount);
        if (isNaN(loanAmount) || loanAmount <= 0) {
            return res.status(400).json({ message: 'Invalid loan amount.' });
        }

        team.personalLoan += loanAmount;
        team.cash += loanAmount;
        await team.save();

        addLogEntry(team.tableId, `Team ${team.teamName} borrowed a loan of ${loanAmount}.`);

        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.handleRepayLoan = async (req, res) => {
    try {
        const { teamId, amount } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const repayAmount = parseFloat(amount);
        if (isNaN(repayAmount) || repayAmount <= 0) {
            return res.status(400).json({ message: 'Invalid repayment amount.' });
        }
        if (team.cash < repayAmount || team.personalLoan < repayAmount) {
            return res.status(400).json({ message: 'Not enough cash or loan outstanding to repay that amount.' });
        }

        team.personalLoan -= repayAmount;
        team.cash -= repayAmount;
        await team.save();

        addLogEntry(team.tableId, `Team ${team.teamName} repaid a loan of ${repayAmount}.`);

        const allTeams = await Team.find({ tableId: team.tableId }).populate('deals');
        const logs = await TableLog.find({ tableId: team.tableId }).sort({ timestamp: -1 });
        res.status(200).json({ teams: allTeams, logs });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};