function ViewContours(panel, name, url) {
    this.panel = panel;
    this.name = name;
    this.url = url;
    this.map = null;
    this.contour_bf = {};
    this.contour_arr = {};
    this.is_ready = false;
    this.panel.canvas.addToLoadingSet(name);
    //Initiate the contour load
    this.panel.view.context.requestHTTP({method: 'GET', url: this.url},
        this._onContoursLoaded.bind(this), this._onContoursFailed.bind(this));
}
ViewContours.prototype._onContoursLoaded = function(response) {
    let data = response.data;
    this.map = {};
    //console.log(this.url + ' contours loaded ' + JSON.stringify(this.map));
    let gl = this.panel.canvas.gl;
    let attrib = this.panel.attrib;
    let hflip = (attrib && ('horizontal_flip' in attrib)) ? 1 : 0;
    let vflip = (attrib && ('vertical_flip' in attrib)) ? 1 : 0;
    let angle = attrib && ('rotate' in attrib) ? attrib['rotate'] : 0;
    let cos_angle = Math.cos(angle);
    let sin_angle = Math.sin(angle);
    //console.log(this.panel.canvas.axis + ' angle ' + angle + ' hflip ' + hflip + ' vflip ' + vflip);
    for(let name in data) {
        let contours = [];
        let contour_bfs = [];
        let contour_arrs = [];
        for(let contour of data[name]) {
            //console.log(name + ' contour ' + JSON.stringify(contour) + ' array length ' + contour.length);
            let contour_arr = new Float32Array(contour.length * 2);
            //Apply attributes
            if(hflip || vflip || angle) {
                contour = contour.map((p) => [
                    (hflip ? -1 : 1) * (p[0] * cos_angle - p[1] * sin_angle),
                    (vflip ? -1 : 1) * (p[0] * sin_angle + p[1] * cos_angle),
                ]);
            }
            contours.push(contour);
            //Flatten [[x1, y1], [x2, y2], ...] to [x1, y1, x2, y2, ...]
            let concated = [].concat.apply([], contour);
            //console.log('loaded array ' + JSON.stringify(concated) + ' array length ' + concated.length);
            contour_arr.set(concated);
            contour_arrs.push(contour_arr);
            let contour_bf = gl.createBuffer();  // Create contour buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, contour_bf);
            gl.bufferData(gl.ARRAY_BUFFER, contour_arr, gl.STATIC_DRAW);
            contour_bf.item_sz = 2;
            contour_bf.item_n = contour.length / 2;
            contour_bfs.push(contour_bf);
        }
        this.contour_bf[name] = contour_bfs;
        this.contour_arr[name] = contour_arrs;
        this.map[name] = contours;
    }
    this.panel.canvas.removeFromLoadingSet(this.name);
    this.is_ready = true; //Mark the image as ready to display
    /*if(this.panel.canvas.axis == 'axial') {
        console.log('hflip ' + hflip + ' vflip ' + vflip + ' angle ' + angle);
        console.log('response.data ' + JSON.stringify(data));
        console.log('map ' + JSON.stringify(this.map));
    }*/
}
ViewContours.prototype._onContoursFailed = function(response) {
    console.log('contours failed to load: ' + this.url);
    this.map = null;
    this.contour_bf = null;
    this.contour_arr = null;
    this.panel.canvas.removeFromLoadingSet(this.name);
    this.is_ready = true; //Mark the image as ready to display
}