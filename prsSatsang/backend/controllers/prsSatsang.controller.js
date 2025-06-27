const prsService = require('../services/prsService');

exports.getAllSatsangs = async (req, res) => {
    try {
        const satsangs = await prsService.fetchAllSatsangs();
        res.status(200).json(satsangs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getSatsangById = async (req, res) => {
    try {
        const satsang = await prsService.fetchSatsangById(req.params.id);
        if (!satsang) return res.status(404).json({ message: 'Satsang not found' });
        res.status(200).json(satsang);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createSatsang = async (req, res) => {
    try {
        const newSatsang = await prsService.addNewSatsang(req.body);
        res.status(201).json(newSatsang);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
