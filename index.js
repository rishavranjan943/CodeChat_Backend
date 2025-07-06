const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./db');
require('dotenv').config();
const http=require('http')


const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/Room')
require('./middleware/passport');

const app = express();
const server=http.createServer(app)


connectDB();

const {initSocket}=require('./socket')
initSocket(server)


app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(
  session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());


app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);



const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server+Socket running at http://localhost:${PORT}`);
});
