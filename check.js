const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ibbi_local';

async function main() {
  await mongoose.connect(uri);
  const Person = require('./backend/src/models/Person.model');
  const results = await Person.find(
    { $or: [{ nome: /Sophia Dantas/i }, { nome: /Rosimeire/i }] },
    { nome: 1, celular: 1 }
  ).lean();
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch(console.error);
