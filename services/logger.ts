
export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  service: string;
  message: string;
  data?: any;
}

class LoggerService {
  private listeners: ((log: LogEntry) => void)[] = [];
  private logs: LogEntry[] = [];

  private notify(entry: LogEntry) {
    this.logs.push(entry);
    // Keep max 200 logs in memory
    if (this.logs.length > 200) this.logs.shift();
    this.listeners.forEach(l => l(entry));
  }

  subscribe(listener: (log: LogEntry) => void) {
    this.listeners.push(listener);
    // Send existing history immediately
    this.logs.forEach(l => listener(l));
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(l => l({ timestamp: new Date().toLocaleTimeString(), level: 'INFO', service: 'System', message: 'Logs cleared' }));
  }

  info(service: string, msg: string, data?: any) {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), level: 'INFO', service, message: msg, data };
    console.log(`%c[${entry.timestamp}] [INFO] [${service}]`, 'color: #2563EB; font-weight: bold;', msg, data || '');
    this.notify(entry);
  }

  success(service: string, msg: string, data?: any) {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), level: 'SUCCESS', service, message: msg, data };
    console.log(`%c[${entry.timestamp}] [SUCCESS] [${service}]`, 'color: #16A34A; font-weight: bold;', msg, data || '');
    this.notify(entry);
  }

  warn(service: string, msg: string, data?: any) {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), level: 'WARN', service, message: msg, data };
    console.warn(`[${entry.timestamp}] [WARN] [${service}] ${msg}`, data || '');
    this.notify(entry);
  }

  error(service: string, msg: string, error?: any) {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), level: 'ERROR', service, message: msg, data: error };
    console.error(`[${entry.timestamp}] [ERROR] [${service}] ${msg}`, error || '');
    this.notify(entry);
  }
}

export const logger = new LoggerService();
