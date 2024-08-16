class Throttle {
    packetsPerTime;
    ms;
    packetsCount = 0;
    packetsCountRead = 0;
    timeout = null;
    queuedPacketsToSend = [];
    queuedPacketsToRead = [];
    constructor(packetsPerTime, ms) {
        this.packetsPerTime = packetsPerTime || 10;
        this.ms = ms || 1000;
    }
    send(executeFunction) {
        if (!this.timeout) {
            this._startTimeout();
        }
        if (this.packetsCount < this.packetsPerTime) {
            this.packetsCount++;
            executeFunction();
        }
        else {
            this.queuedPacketsToSend.push(executeFunction);
        }
    }
    _startTimeout() {
        this.timeout = setTimeout(() => {
            this.packetsCount = 0;
            this.packetsCountRead = 0;
            this.timeout = null;
            if (this.queuedPacketsToSend.length > 0) {
                this._startTimeout();
                this.send(this.queuedPacketsToSend.shift());
            }
            if (this.queuedPacketsToRead.length > 0) {
                this._startTimeout();
                this.read(this.queuedPacketsToRead.shift());
            }
        }, this.ms);
    }
    read(executeFunction) {
        if (!this.timeout) {
            this._startTimeout();
        }
        if (this.packetsCountRead < this.packetsPerTime) {
            this.packetsCountRead++;
            executeFunction();
        }
        else {
            this.queuedPacketsToRead.push(executeFunction);
        }
    }
}
export default Throttle;
//# sourceMappingURL=Throttle.js.map