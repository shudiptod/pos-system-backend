import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  if (process.env.NODE_ENV === "production") {
    console.log(`Server running in production mode on port ${PORT}`);
  } else {
    console.log(`Server running in development mode on port ${PORT}`);
  }

});

server.setTimeout(600000);