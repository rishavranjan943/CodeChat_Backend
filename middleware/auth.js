const jwt=require('jsonwebtoken')
require('dotenv').config()

const verifyToken=(req,res,next)=>{
    const token=req.headers.authorization?.split(" ")[1];
    if(!token)
        return res.status(401).json({error : "No token found"})
    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET)
        req.user=decoded
        next()
    } catch {
        return res.status(401).json({error : "Invalid token"})
    }
}

module.exports={verifyToken}