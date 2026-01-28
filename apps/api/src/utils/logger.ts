import winston from "winston";

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  return `${timestamp} [${level}]: ${stack || message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
  }`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp(),
    errors({ stack: true }), // handle exceptions
    json(), // default to JSON for production
  ),
  defaultMeta: { service: "clusters-api" },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === "production"
          ? combine(timestamp(), json())
          : combine(
              colorize(),
              timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
              devFormat,
            ),
    }),
  ],
});
