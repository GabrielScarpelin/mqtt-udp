class Throttle {
  private packetsPerTime: number;
  private ms: number;
  private packetsCount: number = 0;
  private packetsCountRead: number = 0;
  private timeout: NodeJS.Timeout | null = null;
  private queuedPacketsToSend: (() => void)[] = [];
  private queuedPacketsToRead: (() => void)[] = [];

  constructor(packetsPerTime: number, ms: number) {
    this.packetsPerTime = packetsPerTime || 10;
    this.ms = ms || 1000;
  }

  public send(executeFunction: () => void) {
    if (!this.timeout) {
      this._startTimeout();
    }

    if (this.packetsCount < this.packetsPerTime) {
      this.packetsCount++;
      executeFunction();
    } else {
      this.queuedPacketsToSend.push(executeFunction);
    }
  }

  private _startTimeout() {
    this.timeout = setTimeout(() => {
      this.packetsCount = 0;
      this.packetsCountRead = 0;
      this.timeout = null;
      if (this.queuedPacketsToSend.length > 0) {
        this._startTimeout();
        this.send(this.queuedPacketsToSend.shift()!);
      }
      if (this.queuedPacketsToRead.length > 0) {
        this._startTimeout();
        this.read(this.queuedPacketsToRead.shift()!);
      }
    }, this.ms);
  }
  public read(executeFunction: () => void) {
    if (!this.timeout) {
      this._startTimeout();
    }

    if (this.packetsCountRead < this.packetsPerTime) {
      this.packetsCountRead++;
      executeFunction();
    } else {
      this.queuedPacketsToRead.push(executeFunction);
    }
  }
}

export default Throttle;
