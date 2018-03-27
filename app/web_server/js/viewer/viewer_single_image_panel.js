function ViewerSingleImagePanel(view, canvas) {
    ViewerPanel.call(this, view, canvas);
};
ViewerSingleImagePanel.prototype = Object.create(ViewerPanel.prototype);
ViewerSingleImagePanel.prototype.getSlice = function(slice_index) {
    if(slice_index in this.slices) {
        return this.slices[slice_index];
    }
    if(this.slice_holes.has(slice_index) || this.view.empty) {
        return null;
    }
    let url_start = '/smda/i/' + this.view.context.subject_id;
    let url = this.buildTemplateURL(url_start, slice_index);
    let preview_url = this.buildPreviewTemplateURL(url_start, slice_index);
    let slice = this.slices[slice_index] = {
        index: slice_index,
        image: new ViewImage(this, this.view.key + ':' + slice_index, url),
        preview: new ViewImage(this, this.view.key + ':' + slice_index +
            ':preview', preview_url),
    };
    return slice;
}
ViewerSingleImagePanel.prototype.draw = function() {
    if(!this.gl_initialized) {
        this.initializeGL();
    }
    if(this.pos_bf === null) {
        this.setImageDimensions(this.image_w, this.image_h);
        return;
    }
    let view = this.view;
    let canvas = this.canvas;
    let context = view.context;
    let gl = canvas.gl;
    let shader = canvas.shdr.no_alpha_tex;
    //Exit if the requested texture is not available yet
    let slice = this.getSlice(this.slice);
    if(!slice || !slice.image.is_ready) {
        view.onLoadingImage();
        return;
    }
    if(slice.image.tex === null) {
        view.onMissingImage();
        return;
    }
    view.onLoadedImage();
    //console.log('drawTexture for ' + slice.image_tex);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(shader.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(shader.uniform['uAlpha'], view.alpha / context.max_alpha);
    //Set up modelview matrix
    mat4.identity(this.mv_matrix);
    let scale = context[canvas.axis_prefix + 'scale'] *
        context[canvas.axis_prefix + 'magnification'];
    let attrib = this.attrib;
    let xoffset = attrib && ('xoffset' in attrib) ? attrib.xoffset : 0;
    let yoffset = attrib && ('yoffset' in attrib) ? attrib.yoffset : 0;
    let pan_x = context['pan_' + canvas.axis_prefix + 'x'] + xoffset;
    let pan_y = context['pan_' + canvas.axis_prefix + 'y'] + yoffset;
    let xscale = (attrib && ('horizontal_flip' in attrib) ? -scale : scale)
        * (attrib && ('xscale' in attrib) ? attrib.xscale : 1);
    let yscale = (attrib && ('vertical_flip' in attrib) ? -scale : scale)
        * (attrib && ('yscale' in attrib) ? attrib.yscale : 1);
    let angle = attrib && ('rotate' in attrib) ? attrib['rotate'] : 0;
    //console.log('pos_bf ' + JSON.stringify(this.pos_bf));
    mat4.translate(this.mv_matrix, this.mv_matrix,
        [-pan_x * scale, -pan_y * scale, 0]);
    mat4.rotate(this.mv_matrix, this.mv_matrix, angle, [0, 0, 1]);
    mat4.scale(this.mv_matrix, this.mv_matrix, [xscale, yscale, 1]);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, canvas.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    //Bind the textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, slice.image.tex);
    gl.uniform1i(shader.uniform['uSampler'], 0);
    //Prepare the position attribute pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos_bf);
    gl.enableVertexAttribArray(shader.attrib['aPosition']);
    gl.vertexAttribPointer(shader.attrib['aPosition'],
        this.pos_bf.item_sz, gl.FLOAT, false, 0, 0);
    //Prepare the texture attribute pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoord_bf);
    gl.enableVertexAttribArray(shader.attrib['aTexCoord']);
    gl.vertexAttribPointer(shader.attrib['aTexCoord'],
        this.texcoord_bf.item_sz, gl.FLOAT, false, 0, 0);
    //Draw the ABO as a triangle strip
    gl.drawArrays(gl.TRIANGLES, 0, this.pos_bf.item_n);
    gl.disableVertexAttribArray(shader.attrib['aTexCoord']);
};
