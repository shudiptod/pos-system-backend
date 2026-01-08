import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

});

server.setTimeout(600000);