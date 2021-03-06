define([], function() {

    /**
     * A class for managing a polling event.
     *
     * @param options
     * @constructor
     */
    var Poll = function(options) {

        this.interval = options.interval;
        this.callback = options.callback;

        this._immediate = true;
        if ('immediate' in options) {
            this._immediate = options.immediate;
        }

        this._poll_interval = null;
    };

    Poll.prototype.start = function() {
        if (this._poll_interval === null) {
            this._poll_interval = setInterval(this.callback, this.interval);

            if (this._immediate) {
                this.callback();
            }
        }
    };

    Poll.prototype.stop = function() {
        if (this._poll_interval !== null) {
            clearInterval(this._poll_interval);
            this._poll_interval = null;
        }
    };

    Poll.prototype.isPolling = function() {
        return this._poll_interval !== null;
    };

    return Poll;
});