const mongoose = require('mongoose');

const connectDb = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI não configurada');
  }
  await mongoose.connect(uri);
  console.log('MongoDB conectado');
};

module.exports = connectDb;
