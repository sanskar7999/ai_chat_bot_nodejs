import express from 'express';
import cors from 'cors';
import { generate } from './chatbot.js';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from the server!');
});

app.post('/chat', async (req, res) => {
  const {message, threadId } = req.body;
  
  if (!message || !threadId) {
    return res.status(400).json({ message: 'Message and threadId are required' });
  }

 const result = await generate(message, threadId);

  res.json({ message: result });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});