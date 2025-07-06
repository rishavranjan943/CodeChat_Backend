const express=require('express')
const router=express.Router()
const Room=require('../models/Room')
const {verifyToken}=require('../middleware/auth')
const {getIO}=require('../socket')



router.post('/create',verifyToken,async (req,res)=>{
    const {roomId}=req.body;
    if(!roomId)
            return res.status(400).json({error:"Room ID is required"})
    const exists=await Room.findOne({roomId})
    if(exists)
            return res.status(400).json({error:"Room already exists"})
    const newRoom=await Room.create({
        roomId,
        createdBy:req.user.id,
    })
    return res.status(200).json({room:newRoom})
})


router.get("/:roomId", verifyToken, async (req, res) => {
    const room = await Room.findOne({ roomId: req.params.roomId })
    if (!room) return res.status(404).json({ error: "Room not found" })
  
    return res.status(200).json({ room })
})

router.delete("/:roomId", verifyToken, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the creator can delete the room" });
    }

    await Room.deleteOne({ roomId: req.params.roomId });
    const io = getIO();
    io.to(req.params.roomId).emit("room-deleted");
    io.socketsLeave(req.params.roomId);

    return res.json({ message: "Room deleted and users notified" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Server error while deleting room" });
  }
});
  
module.exports=router