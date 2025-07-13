// routes/api/error.js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("error/500");
});

module.exports = router;
