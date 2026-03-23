interface Logger {
  info(msg: string): void;
  error(msg: string): void;
}

let logger: Logger = {
  info: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
};

export function setLogger(custom: Logger): void {
  logger = custom;
}

export function getLogger(): Logger {
  return logger;
}
