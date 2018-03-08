function ViewImage(panel, name, url) {
	this.panel = panel;
	this.name = name;
	this.url = url;
	this.image = new Image();
    this.width = 0;
    this.height = 0;
	this.tex = null;
	this.is_ready = false;
    this.panel.canvas.addToLoadingSet(name);
    //Initiate the image load
    this.image.crossOrigin = 'anonymous';
    this.image.onload = this._onImageLoaded.bind(this);
    this.image.onerror = this._onImageFailed.bind(this);
    this.image.src = url;
}
ViewImage.prototype._onImageLoaded = function() {
    let gl = this.panel.canvas.gl;
    this.width = this.image.width;
    this.height = this.image.height;
    this.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
        this.image);  //Load the OpenGL texture
    delete this['image'];
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.panel.canvas.removeFromLoadingSet(this.name);
    this.is_ready = true; //Mark the image as ready to display
}
ViewImage.prototype._onImageFailed = function() {
    console.log("Texture failed to load: " + this.url);
    this.tex = null;
    delete this['image'];
    this.panel.canvas.removeFromLoadingSet(this.name);
    this.is_ready = true; //Mark the image as ready to display
}