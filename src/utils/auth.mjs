import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/constants.mjs";

export const validateJwtToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization header missing or malformed");
  }

  // Extract the JWT from the "Bearer" token
  const token = authHeader.split(" ")[1];

  try {
    // Verify the token with the secret (or public key for RSA)
    const decoded = jwt.verify(token, JWT_SECRET);

    // Extract the user
    const {user} = decoded;

    if (!user) {
      throw new Error("User not found in token");
    }

    // Return an object with the user
    return {
      user,
    };
  } catch (error) {
    throw new Error(`Invalid token: ${  error.message}`);
  }
};