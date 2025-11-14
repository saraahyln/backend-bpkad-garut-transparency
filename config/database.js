const { PrismaClient } = require("@prisma/client");
const NodeCache = require("node-cache");

// Initialize Prisma and Cache
const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: process.env.CACHE_TTL || 300 }); // 5 minutes default

module.exports = { prisma, cache };
