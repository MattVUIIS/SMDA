function ViewerPanel(view, canvas) {
    this.view = view;
    this.canvas = canvas;
    this.mv_matrix = mat4.create();  //Modelview projection matrix
    this.slice = null;
    this.slices = {};
    this.slice_holes = new Set();
    this.min_slice = null;
    this.max_slice = null;
    this.image_w = null;
    this.image_h = null;
    this.attrib = null;
    this.pos_bf = null;
    this.pos_arr = null;
    this.gl_initialized = false;
    this.left_border = null;
    this.right_border = null;
    this.top_border = null;
    this.bottom_border = null;
    this.use_mouse_point = null;
};
ViewerPanel.prototype.setSlice = function(slice) {
    let slice_name = this.canvas.axis_prefix + 'slice';
    let min_slice_name = 'min_' + slice_name;
    let max_slice_name = 'max_' + slice_name;
    this.slice = Math.max(this.view.context[min_slice_name],
        Math.min(this.view.context[max_slice_name], slice));
    //console.log(this.canvas.axis + ' ' + this.view.name + ' set slice to ' + slice);
    return this.view.context.view_params;
};
ViewerPanel.prototype.initializeGL = function() {
    let canvas = this.canvas;
    let gl = canvas.gl;
    this.texcoord_bf = gl.createBuffer(); //Create texture buffer
    this.texcoord_arr = new Float32Array([0.0, 0.0, 1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoord_bf);
    gl.bufferData(gl.ARRAY_BUFFER, this.texcoord_arr, gl.STATIC_DRAW);
    this.texcoord_bf.item_sz = 2;
    this.texcoord_bf.item_n = 6;
    this.gl_initialized = true;
};
ViewerPanel.prototype.setImageDimensions = function(image_w, image_h) {
    let canvas = this.canvas;
    let gl = canvas.gl;
    if(image_w === null || image_h === null) {
        return;
    }
    this.image_w = image_w;
    this.image_h = image_h;
    let x = (image_w >= image_h ? 1 : image_w / image_h) * canvas.ortho.right;
    let y = (image_w >= image_h ? image_h / image_w : 1) * canvas.ortho.top;
    //console.log('setImageDimensions ' + this.view.modality + ' ' + this.view.submodality + ' ' + canvas.axis +
    //    ' image_w ' + image_w + ' image_h ' + image_h + ' x ' + x + ' y ' + y);
    if(this.pos_arr === null) {
        this.pos_arr = new Float32Array(3 * 6);
    }
    this.pos_arr.set([-x, y, 0, // Lower left
        x, y, 0,  // Lower right
        x, -y, 0,  // Upper right
        -x, y, 0,  // Lower right
        x, -y, 0,  // Upper right
        -x, -y, 0]);  // Upper left
    //console.log(this.view.modality + ' ' + this.view.submodality + ' ' + canvas.axis +
    //    ' image_w ' + image_w + ' image_h ' + image_h + ' x ' + x + ' y ' + y);
    this.left_border = this.pos_arr[0];
    this.right_border = this.pos_arr[3];
    this.top_border = this.pos_arr[1];
    this.bottom_border = this.pos_arr[7];
    canvas.updatePlane();
    if(gl === null) {
        return;
    }
    if(this.pos_bf === null) {
        this.pos_bf = gl.createBuffer();  // Create position buffer
    }
    //console.log(this.view.name + ' ' + canvas.axis + ' left: ' + this.left_border +
    //    ' top: ' + this.top_border + ' right: ' + this.right_border +
    //    ' bottom: ' + this.bottom_border);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos_bf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pos_arr, gl.STATIC_DRAW);
    this.pos_bf.item_sz = 3;
    this.pos_bf.item_n = 6;
}
ViewerPanel.prototype.buildTemplateURL = function(url_start, slice_index) {
    return '';
}
ViewerPanel.prototype.buildPreviewTemplateURL = function(url_start, slice_index) {
    return '';
}
ViewerPanel.prototype.getSlice = function(slice_index) {
    //Override this
}
ViewerPanel.prototype.resetSlices = function() {
    this.slices = {};
}
ViewerPanel.prototype.setUseMousePoint = function(value) {
    this.use_mouse_point = value;
}
ViewerPanel.prototype.onMousePoint = function(px, py) {

}
