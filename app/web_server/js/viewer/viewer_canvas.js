/*
    Encapsulates the canvas element of the viewer
    This class has a dependency on jQuery
*/
function ViewerCanvas(context, axis, axis_prefix) {
	this.context = context;
    this.axis = axis;
    this.axis_prefix = axis_prefix;
    this.base_width = this.base_height = 256;
    this.viewport = this.gl = this.parent = this.row =
        this.composite_tex = this.composite_fb = null;
    this.shdr = {};
    this.width_perc = 100;
    this.minimap_enabled = false;
    this.id = 'canvas_' + axis;
    //HTML elements
    this.element = angular.element('<canvas id="' + this.id
        + '" class="panelCanvas"></canvas>');
    //Initialize canvas mousemove event
    this.element.mousemove(this.onDefaultMouseMove.bind(this));
    this.element.mouseout(this.onDefaultMouseOut.bind(this));
    this.element.hide();
    this.spinner_key = axis + '_spinner';
    this.spinner = context.createSpinnerElement(this.spinner_key);
    $(window).resize(this.resize.bind(this));
    //The orthogonal projection has been chosen to face outwards,
    //as in out of the screen, with repective to OpenGL's coordinate system
    //This means that negative x is the viewer's right, positive x is the
    //viewer's left, negative z goes toward the viewer, and positive z goes
    //into the screen. The y directions remain the same as the original, where
    //positive y is up and negative y is down.
    this.ortho = {left: -0.5, right: 0.5, bottom: -0.5, top: 0.5,
        near: -2, far: 10.1};
    this.p_matrix = mat4.create();
    mat4.ortho(this.p_matrix, this.ortho.left, this.ortho.right,
        this.ortho.bottom, this.ortho.top, this.ortho.near, this.ortho.far);
    this.ortho_xspan = this.ortho.right - this.ortho.left;
    this.ortho_yspan = this.ortho.top - this.ortho.bottom;
    this.ortho_xoffset = this.ortho.left;
    this.ortho_yoffset = this.ortho.bottom;
    this.mv_matrix = mat4.create();  //Modelview projection matrix
    //Set the image plane that represents the boundary of all of the contained panels' images
    this.plane = {left: null, top: null, right: null, bottom: null,
        width: null, height: null};
    //Set other things
    this.mos_win_pos = {x: 0, y: 0};
    this.prev_mos_pos = {x: 0, y: 0};
    this.mos_pos = [0, 0];
    this.active = false;
    this.active_views = [];
    this.minimap_arr = new Float32Array(15);
    this.crosshair_arr = new Float32Array(12);
    this.view_left = this.view_bottom = this.view_right = this.view_top = 0;
    this.letter_texture = null;
    //Axis letters are starting from the top and going around clockwise
    this.axis_letters = (this.axis == 'coronal' ? 'SRIL'
        : this.axis == 'axial' ? 'ARPL'
        : 'SPIA').split('');
    this.minimap_size = 1 / 4;
    this.minimap_enabled = true;
    this.loading_set = new Set();
    this.tooltip_id = 'canvas_' + axis;
    this.tooltip = angular.element('<span id="' + this.tooltip_id +
        '" class="panelTooltip"></span>');
    this.tooltip.text('text');
    this.tooltip.hide();
}
ViewerCanvas.prototype.setHTMLElementParents = function(parent, row) {
    this.parent = parent;
    this.row = row;
}
ViewerCanvas.prototype.addToLoadingSet = function(name) {
    this.loading_set.add(name);
    this.activateSpinner();
}
ViewerCanvas.prototype.removeFromLoadingSet = function(name) {
    this.loading_set.delete(name);
    if(this.loading_set.size == 0) {
        this.deactivateSpinner();
    }
}
ViewerCanvas.prototype.initializeGL = function() {
    let gl = null;
    try {
        gl = this.gl = this.element[0].getContext('experimental-webgl', { alpha: false });
        let float_texture_ext = gl.getExtension('OES_texture_float');
        if (!float_texture_ext) {
            alert('no floating point texture support');
        }
        let vp = gl.getParameter(gl.VIEWPORT);
        this.viewport = {x: vp[0], y: vp[1], w: vp[2], h: vp[3]};
        //Initialize Shaders
        this.shdr.color = new ViewerShader(gl);
        this.shdr.color.initialize({
            vertex: ['shader-vs'],
            fragment: ['shader-fs-color']
        });
        this.shdr.white = new ViewerShader(gl);
        this.shdr.white.initialize({
            vertex: ['shader-vs'],
            fragment: ['shader-fs-white']
        });
        this.shdr.basic_tex = new ViewerShader(gl);
        this.shdr.basic_tex.initialize({
            vertex: ['shader-vs-tex'],
            fragment: ['shader-fs-tex']
        });
        this.shdr.no_alpha_tex = new ViewerShader(gl);
        this.shdr.no_alpha_tex.initialize({
            vertex: ['shader-vs-tex'],
            fragment: ['shader-fs-no-alpha-tex']
        });
        //Create position buffer
        this.pos_bf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pos_bf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                this.ortho_xoffset, -this.ortho_yoffset, 0,
                -this.ortho_xoffset, -this.ortho_yoffset, 0,
                -this.ortho_xoffset, this.ortho_yoffset, 0,
                this.ortho_xoffset, -this.ortho_yoffset, 0,
                -this.ortho_xoffset, this.ortho_yoffset, 0,
                this.ortho_xoffset, this.ortho_yoffset, 0,
            ]), gl.STATIC_DRAW);
        this.pos_bf.item_sz = 3;
        this.pos_bf.item_n = 6;
        //Create texture buffer
        this.texcoord_bf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoord_bf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 0.0, 1.0, 0.0,
            1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0]), gl.STATIC_DRAW);
        this.texcoord_bf.item_sz = 2;
        this.texcoord_bf.item_n = 6;
        //Create crosshair buffer
        this.crosshair_bf = gl.createBuffer();
        this.minimap_bf = gl.createBuffer();
    }
    catch(e) {
        console.log('Exception occurred: ' + e);
    }
    if (!gl) {
        alert('Could not initialize WebGL, sorry');
        return;
    }
};
ViewerCanvas.prototype.initializeFramebuffer = function() {
    let gl = this.gl;
    if(this.composite_fb !== null) {
        gl.deleteTexture(this.composite_tex);
        gl.deleteFramebuffer(this.composite_fb);
        this.composite_fb = this.composite_tex = null;
    }
    if(this.viewport.w == 0) {
        return;
    }
    this.composite_fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.composite_fb);
    this.composite_tex = gl.createTexture();
    this.composite_w = this.viewport.w;
    this.composite_h = this.viewport.h;
    gl.bindTexture(gl.TEXTURE_2D, this.composite_tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, this.composite_w,
        this.composite_h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, this.composite_tex, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
        switch(gl.checkFramebufferStatus(gl.FRAMEBUFFER)) {
            case gl.FRAMEBUFFER_UNDEFINED:
                console.log("FRAMEBUFFER_UNDEFINED");
            break;
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                console.log("FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
            break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                console.log("FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
            break;
            case gl.FRAMEBUFFER_INCOMPLETE_DRAW_BUFFER:
                console.log("FRAMEBUFFER_INCOMPLETE_DRAW_BUFFER");
            break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                console.log("FRAMEBUFFER_UNSUPPORTED");
            break;
        }
    }
    gl.viewport(0, 0, this.composite_w, this.composite_h);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); //Clear the framebuffer
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); //Unbind
}
/*
    _processPageCoordinates
    Gets the correct position of the mouse with respect to the page element
*/
ViewerCanvas.prototype._processPageCoordinates = function(event) {
    event = event || window.event;
    if(event.pageX == null && event.clientX != null) {
        let eventDoc = (event.target && event.target.ownerDocument) ||
            document;
        let doc = eventDoc.documentElement;
        let body = eventDoc.body;
        event.pageX = event.clientX +
          (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
          (doc && doc.clientLeft || body && body.clientLeft || 0);
        event.pageY = event.clientY +
          (doc && doc.scrollTop || body && body.scrollTop || 0) -
          (doc && doc.clientTop || body && body.clientTop || 0);
    }
    return event;
}
ViewerCanvas.prototype.resize = function() {
    let width_factor = Math.max(0, Math.floor(this.parent.parent().width()
        * this.width_perc / this.base_width));
    if(width_factor == 0) {
        width_factor = 1;
        //console.log(this.axis + ' width_factor reset to ' + width_factor);
    }
    else {
        //console.log(this.axis + ' width_factor: ' + width_factor);
    }
    let height_factor = Math.max(1, width_factor);
    let width = this.base_width * width_factor;
    let height = this.base_height * height_factor;
    this.parent.css({'width': width + 'px', 'height': height + 'px'});
    let gl_canvas = this.gl.canvas;
    let display_width = gl_canvas.clientWidth;
    let display_height = gl_canvas.clientHeight;
    if(gl_canvas.width != display_width
            || gl_canvas.height != display_height) {
        this.viewport.w = gl_canvas.width = display_width;
        this.viewport.h = gl_canvas.height = display_height;
    }
    this.initializeFramebuffer();
};
ViewerCanvas.prototype.activateSpinner = function() {
    this.context.activateSpinner(this.spinner_key);
}
ViewerCanvas.prototype.deactivateSpinner = function() {
    this.context.deactivateSpinner(this.spinner_key);
}
ViewerCanvas.prototype.onDefaultMouseMove = function(event) {
    event = this._processPageCoordinates(event);
    let rect = this.element[0].getBoundingClientRect();
    this.mos_win_pos = {x: event.pageX - (rect.left + window.scrollX),
        y: event.pageY - (rect.top + window.scrollY)};
    this.mos_pos = this.unProject(this.mos_win_pos.x, this.mos_win_pos.y);
    //console.log('mos_win_pos: ' + JSON.stringify(this.mos_win_pos) +
    // ' mos_pos: ' + JSON.stringify(this.mos_pos));
    //Get the scroll wheel info, 1 is up and -1 is down
    this.wheel_delta = Math.max(-1, Math.min(1, event.wheelDelta
        || -event.detail));

    let pan_x = this.context['pan_' + this.axis_prefix + 'x'];
    let pan_y = this.context['pan_' + this.axis_prefix + 'y'];
    let magnification = this.context[this.axis_prefix + 'magnification'];
    let scale = this.context[this.axis_prefix + 'scale'];
    let zoom_factor = 1 / magnification / scale;
    let space_x = this.mos_pos.x * zoom_factor + pan_x;
    let space_y = this.mos_pos.y * zoom_factor + pan_y;
    //console.log('canvas space_x ' + space_x + ' space_y ' + space_y);
    this.onMousePoint(space_x, space_y);
}
ViewerCanvas.prototype.onDefaultMouseOut = function(event) {
    this.onMouseOut();
}
/*
    unProject
    Takes a window coordinate and returns the world coordinate
*/
ViewerCanvas.prototype.unProject = function(win_x, win_y, ortho) {
    //In OpenGL, positive Y is up but in the canvas, positive Y is down. So we
    //flip the win_y parameter by subtracting it from the canvas height.
    let client_w = this.element.prop('clientWidth');
    let client_h = this.element.prop('clientHeight');
    ortho = ortho ? ortho : this.ortho;
    win_y = client_h - win_y;
    return {
        x: ((ortho.right - ortho.left) * win_x / client_w) + ortho.left,
        y: ((ortho.top - ortho.bottom) * win_y / client_h) + ortho.bottom,
    };
};
ViewerCanvas.prototype.toggleMinimap = function() {
    this.minimap_enabled = !this.minimap_enabled;
};
ViewerCanvas.prototype.checkPanBounds = function() {
    let axis_prefix = this.axis_prefix;
    let pan_x = this.context['pan_' + axis_prefix + 'x'];
    let pan_y = this.context['pan_' + axis_prefix + 'y'];
    let magnification = this.context[axis_prefix + 'magnification'];
    let scale = this.context[axis_prefix + 'scale'];
    let zoom_factor = 1 / magnification / scale;
    this.view_left = pan_x + this.ortho_xoffset * zoom_factor;
    this.view_bottom = pan_y + this.ortho_yoffset * zoom_factor;
    this.view_right = this.view_left + this.ortho_xspan * zoom_factor;
    this.view_top = this.view_bottom + this.ortho_yspan * zoom_factor;
    for(let view of this.active_views) {
        view.checkPanBounds(this);
    }
};
ViewerCanvas.prototype.activateView = function(view) {
    let index = this.active_views.findIndex(x => x === view);
    if(index == -1) {
        //console.log('activate view ' + view.modality + ' in canvas ' +
        //    this.axis);
        this.active_views.push(view);
        this.sortViews();
        this.element.show();
        this.parent.show();
        this.row.element.show();
        this.adjustRowSize();
    }
}
ViewerCanvas.prototype.deactivateView = function(view) {
    let index = this.active_views.findIndex(x => x === view);
    if(index != -1) {
        //console.log('deactivate view ' + view.modality + ' in canvas ' +
        //    this.axis);
        this.active_views.splice(index, 1);
        if(this.active_views.length == 0) {
            this.element.hide();
            this.tooltip.hide();
            this.parent.hide();
            this.adjustRowSize();
            for(let canvas_i in this.row.canvas) {
                let canvas = this.row.canvas[canvas_i];
                if(canvas.active_views.length) {
                    return 0; //At least one canvas is active
                }
            }
            //No canvases are active so hide the parent row
            this.row.element.hide();
        }
        else {
            this.sortViews();
        }
    }
}
ViewerCanvas.prototype.sortViews = function() {
    this.active_views.sort((a, b) => b.getLayer() - a.getLayer());
    return this.active_views;
}
ViewerCanvas.prototype.isActive = function() {
    return this.active_views.length > 0;
}
ViewerCanvas.prototype.adjustRowSize = function() {
    //We set active_n to 2 on the sagittal canvas, which is on its own row,
    //so that it will have the same size as coronal and axial canvases
    let active_n = (this.axis == 'sagittal') ? 2 :
        (this.context.canvas.axial.active_views.length > 0) ? 2 :
        1;
    let canvas_spaces = Math.pow(2, Math.ceil(Math.log2(active_n)));
    let canvas_row_n = Math.floor(Math.sqrt(canvas_spaces));
    let canvas_col_n = Math.ceil(canvas_spaces / canvas_row_n);
    let cntnr_w = this.context.canvas_container.width();
    let canvas_margin = 1; // in pixels
    let canvas_col_w = (cntnr_w / canvas_col_n) -
        canvas_margin * (canvas_col_n - 1);
    let width_perc = canvas_col_w / cntnr_w;
    //console.log('resize all canvas to width ' + width_perc);
    for(let canvas_i in this.row.canvas) {
        let canvas = this.row.canvas[canvas_i];
        canvas.width_perc = canvas.active_views ? width_perc : 0;
        canvas.resize();
    }
}
ViewerCanvas.prototype.drawCrosshair = function() {
    let context = this.context;
    let gl = this.gl;
    let crosshair = context.crosshair;
    let shader = this.shdr.white;
    let zoom = context[this.axis_prefix + 'zoom'];
    let pan_x = context['pan_' + this.axis_prefix + 'x'];
    let pan_y = context['pan_' + this.axis_prefix + 'y'];
    let magnification = context[this.axis_prefix + 'magnification'];
    let scale = context[this.axis_prefix + 'scale'];
    let xscale = magnification * scale;
    let yscale = magnification * scale;
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ZERO);  // Invert the background color
    gl.useProgram(shader.program);
    mat4.identity(this.mv_matrix);
    mat4.translate(this.mv_matrix, this.mv_matrix,
        [-pan_x * xscale, -pan_y * yscale, 0]);
    mat4.scale(this.mv_matrix, this.mv_matrix,
        [xscale, yscale, 1]);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    //console.log('shader ' + JSON.stringify(shader));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crosshair_bf);
    let plane_x = crosshair.x;
    let plane_y = crosshair.y;
    if(this.axis == 'coronal') {
        //Plane is already set
    }
    else if (this.axis == 'axial') {
        plane_x = crosshair.x;
        plane_y = -crosshair.z;
    }
    else if (this.axis == 'sagittal') {
        plane_x = crosshair.z;
        plane_y = crosshair.y;
    }
    let volume_xscale = this.plane.left /
        (this.axis == 'sagittal' ? context.volume.front : context.volume.left);
    let volume_yscale = this.plane.bottom /
        (this.axis == 'axial' ? context.volume.front : context.volume.bottom);
    plane_x *= volume_xscale;
    plane_y *= volume_yscale;
    let z = -0.5;
    //console.log('crosshair = ' + JSON.stringify(crosshair));
    let left = Math.min(-1, this.view_left);
    let right = Math.max(1, this.view_right);
    let bottom = Math.min(-1, this.view_bottom);
    let top = Math.max(1, this.view_top);
    this.crosshair_arr.set([left, plane_y, z, right, plane_y, z,
        plane_x, bottom, z, plane_x, top, z]);
    gl.bufferData(gl.ARRAY_BUFFER, this.crosshair_arr, gl.STATIC_DRAW);
    //Draw the ABO as a triangle strip
    gl.enableVertexAttribArray(shader.attrib['aPosition']);
    gl.vertexAttribPointer(shader.attrib['aPosition'], 3, gl.FLOAT, false, 0, 0);
    gl.lineWidth(1);
    gl.drawArrays(gl.LINES, 0, 4);
}
ViewerCanvas.prototype.drawAxisLabels = function() {
    let context = this.context;
    let gl = this.gl;
    let shader = this.shdr.no_alpha_tex;
    //console.log('drawAxisLabels for ' + panel.name);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);  // Invert the background color
    gl.useProgram(shader.program);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shader.uniform['uSampler'], 0);
    gl.uniform1f(shader.uniform['uAlpha'], 1.0);
    //Prepare the label textures
    if(!this.letter_texture) {
        let context2d = document.createElement('canvas').getContext('2d');
        let size = 64;
        context2d.canvas.width = size;
        context2d.canvas.height = size;
        context2d.font = '60px monospace';
        context2d.textAlign = 'center';
        context2d.textBaseline = 'middle';
        context2d.fillStyle = 'white';
        this.letter_texture = {};
        for(let i in this.axis_letters) {
            let letter = this.axis_letters[i];
            context2d.clearRect(0, 0, size, size);
            context2d.fillText(letter, size / 2, size / 2);
            let texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
                context2d.canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.letter_texture[letter] = texture;
        }
    }
    //Prepare the attribute pointers
    gl.enableVertexAttribArray(shader.attrib['aPosition']);
    gl.enableVertexAttribArray(shader.attrib['aTexCoord']);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoord_bf);
    //Draw the four labels, starting from the top and going around clockwise
    let angle = context.half_pi;
    /*let a_squared = Math.pow(0.45, 2);
    let b_squared = Math.pow(0.45, 2);
    let f = (x) => b_squared * (1 - Math.pow(x, 2) / a_squared);
    let vals = [0, 0.45];
    let coords = [[vals[0], f(vals[0])],
        [vals[1], f(vals[1])],
        [vals[0], -f(vals[0])],
        [-vals[1], f(-vals[1])],
    ];*/
    for(let i in this.axis_letters) {
        let letter = this.axis_letters[i];
        let x = 0.45 * Math.cos(angle) * this.ortho_xspan;
        let y = 0.45 * Math.sin(angle) * this.ortho_yspan;
        //let [x, y] = coords[i];
        mat4.identity(this.mv_matrix);
        mat4.translate(this.mv_matrix, this.mv_matrix, [x, y, 0]);
        mat4.scale(this.mv_matrix, this.mv_matrix, [0.08, 0.08, 1]);
        gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false,
            this.mv_matrix);
        gl.bindTexture(gl.TEXTURE_2D, this.letter_texture[letter]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pos_bf);
        gl.vertexAttribPointer(shader.attrib['aPosition'],
            3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoord_bf);
        gl.vertexAttribPointer(shader.attrib['aTexCoord'],
            this.texcoord_bf.item_sz, gl.FLOAT, false, 0, 0);
        //Draw the ABO as a triangle strip
        gl.drawArrays(gl.TRIANGLES, 0, this.pos_bf.item_n);
        angle -= context.half_pi;
    }
    gl.disableVertexAttribArray(shader.attrib['aTexCoord']);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
};
ViewerCanvas.prototype.drawMinimap = function() {
    //console.log('drawMinimap for ' + this.panel.name);
    let context = this.context;
    let gl = this.gl;
    let shader = this.shdr.no_alpha_tex;
    //Draw all the preview images onto the minimap texture
    let old_viewport = gl.getParameter(gl.VIEWPORT);
    let old_fb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.composite_fb);
    gl.viewport(0, 0, this.composite_w, this.composite_h);
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1000);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(shader.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shader.uniform['uSampler'], 0);
    for(let view_name in this.active_views) {
        let view = this.active_views[view_name];
        let subpanel = view.panels[this.axis];
        if(!subpanel || subpanel.pos_bf === null) {
            continue;
        }
        let subslice = subpanel.getSlice(subpanel.slice);
        if(!subslice || !subslice.preview.is_ready || subslice.preview.tex === null) {
            continue;
        }
        if(view.modality == 'hist') {
            //console.log('histology preview draw ' + subpanel.pos_bf.item_n);
        }
        //Set up the view matrix
        let attrib = subpanel.attrib;
        let xscale = (attrib && ('horizontal_flip' in attrib) ? -1 : 1)
            * (attrib && ('xscale' in attrib) ? attrib.xscale : 1);
        let yscale = (attrib && ('vertical_flip' in attrib) ? -1 : 1)
            * (attrib && ('yscale' in attrib) ? attrib.yscale : 1);
        let angle = attrib && ('rotate' in attrib) ? attrib['rotate'] : 0;
        //xscale = -1;
        //angle = -90 * Math.PI / 180;
        mat4.identity(this.mv_matrix);
        mat4.translate(this.mv_matrix, this.mv_matrix, [0, 0, 0]);
        mat4.rotate(this.mv_matrix, this.mv_matrix, angle, [0, 0, 1]);
        mat4.scale(this.mv_matrix, this.mv_matrix, [xscale, yscale, 1]);
        gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
        gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
        //Set up texture and alpha
        gl.bindTexture(gl.TEXTURE_2D, subslice.preview.tex);
        gl.uniform1f(shader.uniform['uAlpha'],
            subpanel.view.alpha / context.max_alpha);
        //Prepare the position attribute pointer
        gl.bindBuffer(gl.ARRAY_BUFFER, subpanel.pos_bf);
        gl.enableVertexAttribArray(shader.attrib['aPosition']);
        gl.vertexAttribPointer(shader.attrib['aPosition'],
            subpanel.pos_bf.item_sz, gl.FLOAT, false, 0, 0);
        //Prepare the texture attribute pointer
        gl.bindBuffer(gl.ARRAY_BUFFER, subpanel.texcoord_bf);
        gl.enableVertexAttribArray(shader.attrib['aTexCoord']);
        gl.vertexAttribPointer(shader.attrib['aTexCoord'],
            subpanel.texcoord_bf.item_sz, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, subpanel.pos_bf.item_n);
    }
    //Draw the minimap image onto the canvas composite
    gl.useProgram(shader.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, old_fb);
    gl.viewport(old_viewport[0], old_viewport[1], old_viewport[2], old_viewport[3]);
    let mini_sz = this.minimap_size;
    let xshift = this.ortho.right / mini_sz - this.ortho.right;
    let yshift = this.ortho.top / mini_sz - this.ortho.top;
    //console.log('mini_sz: ' + mini_sz + ' xshift: ' + xshift + ' yshift: ' + yshift);
    mat4.identity(this.mv_matrix);
    mat4.scale(this.mv_matrix, this.mv_matrix, [mini_sz, -mini_sz, 1]);
    mat4.translate(this.mv_matrix, this.mv_matrix, [xshift, -yshift, 0]);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.composite_tex);
    gl.uniform1i(shader.uniform['uSampler'], 0);
    gl.uniform1f(shader.uniform['uAlpha'], 1.0);
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
    gl.drawArrays(gl.TRIANGLES, 0, this.pos_bf.item_n);
    gl.disableVertexAttribArray(shader.attrib['aTexCoord']);
    //Draw the crosshair onto the minimap texture
    shader = this.shdr.white;
    gl.useProgram(shader.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ZERO);  // Invert the background color
    mat4.identity(this.mv_matrix);
    mat4.scale(this.mv_matrix, this.mv_matrix, [mini_sz, mini_sz, 1]);
    mat4.translate(this.mv_matrix, this.mv_matrix, [xshift, yshift, 0]);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crosshair_bf);
    let crosshair = context.crosshair;
    let plane_x = crosshair.x;
    let plane_y = crosshair.y;
    if(this.axis == 'coronal') {
        //Plane is already set
    }
    else if (this.axis == 'axial') {
        plane_x = crosshair.x;
        plane_y = -crosshair.z;
    }
    else if (this.axis == 'sagittal') {
        plane_x = crosshair.z;
        plane_y = crosshair.y;
    }
    let volume_xscale = this.plane.left /
        (this.axis == 'sagittal' ? context.volume.front : context.volume.left);
    let volume_yscale = this.plane.bottom /
        (this.axis == 'axial' ? context.volume.front : context.volume.bottom);
    plane_x *= volume_xscale;
    plane_y *= volume_yscale;
    let left = this.ortho.left;
    let right = this.ortho.right;
    let bottom = this.ortho.bottom;
    let top = this.ortho.top;
    this.crosshair_arr.set([left, plane_y, 0, right, plane_y, 0,
        plane_x, bottom, 0, plane_x, top, 0]);
    gl.bufferData(gl.ARRAY_BUFFER, this.crosshair_arr, gl.STATIC_DRAW);
    //Draw the ABO as a triangle strip
    gl.enableVertexAttribArray(shader.attrib['aPosition']);
    gl.vertexAttribPointer(shader.attrib['aPosition'], 3, gl.FLOAT, false, 0, 0);
    gl.lineWidth(1);
    gl.drawArrays(gl.LINES, 0, 4);
    //Draw the view rectangle
    shader = this.shdr.color;
    gl.useProgram(shader.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(this.viewport.w - this.viewport.w * mini_sz,
        this.viewport.h - this.viewport.h * mini_sz,
        this.viewport.w * mini_sz, this.viewport.h * mini_sz);
    mat4.identity(this.mv_matrix);
    mat4.scale(this.mv_matrix, this.mv_matrix, [mini_sz, mini_sz, 1]);
    mat4.translate(this.mv_matrix, this.mv_matrix, [xshift, yshift, 0]);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    gl.uniform4fv(shader.uniform['vColor'], [1.0, 0.0, 0.0, 1.0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.minimap_bf);
    let x1 = this.view_left;
    let y1 = this.view_bottom;
    let x2 = this.view_right;
    let y2 = this.view_top;
    //console.log('minimap (x1, y1), (x2, y2) = (' + x1 + ', ' + y1 + '), (' + x2 + ', ' + y2 + ')');
    this.minimap_arr.set([x1, y1, 0, x2, y1, 0, x2, y2, 0, x1, y2, 0, x1, y1, 0]);
    gl.bufferData(gl.ARRAY_BUFFER, this.minimap_arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(shader.attrib['aPosition']);
    gl.vertexAttribPointer(shader.attrib['aPosition'], 3, gl.FLOAT, false, 0, 0);
    gl.lineWidth(1);
    gl.drawArrays(gl.LINE_STRIP, 0, 5);
    gl.disable(gl.SCISSOR_TEST);
};
ViewerCanvas.prototype.updatePlane = function() {
    this.plane.left = this.ortho.left;
    this.plane.right = this.ortho.right;
    this.plane.top = this.ortho.top;
    this.plane.bottom = this.ortho.bottom;
    //console.log(this.axis + ' canvas border default ' + panel_left + ', ' +
    //    panel_right + ', ' + panel_bottom + ', ' + panel_top);
    for(let id in this.context.views) {
        let view = this.context.views[id];
        if(this.axis in view.panels) {
            let panel = view.panels[this.axis];
            if(panel.left_border != null) { //TODO: Should check if panel is null?
                //console.log(this.axis + ' ' + panel.view.modality + ' ' + panel.view.submodality + ' panel position '
                //    + panel.left_border + ', ' + panel.right_border +
                //    ', ' + panel.bottom_border + ', ' + panel.top_border);
                this.plane.left = Math.max(this.plane.left, panel.left_border);
                this.plane.top = Math.min(this.plane.top, panel.top_border);
                this.plane.right = Math.min(this.plane.right, panel.right_border);
                this.plane.bottom = Math.max(this.plane.bottom, panel.bottom_border);
            }
        }
    }
    this.plane.width = this.plane.right - this.plane.left;
    this.plane.height = this.plane.top - this.plane.bottom;
    //console.log(this.axis + ' plane ' + JSON.stringify(this.plane));
    this.context.updateVolume();
}
ViewerCanvas.prototype.onMousePoint = function(mos_pos_x, mos_pos_y) {
    let tooltip = this.tooltip;
    //tooltip.show();
    //tooltip.text('' + mos_pos_x + ', ' + mos_pos_y);
    for(let view of this.active_views) {
        let panel = view.panels[this.axis];
        if(panel && panel.use_mouse_point) {
            panel.onMousePoint(mos_pos_x, mos_pos_y);
        }
    }
    let width = tooltip[0].clientWidth;
    let height = tooltip[0].clientHeight;
    let left = this.mos_win_pos.x - width / 2;
    let top = this.mos_win_pos.y - height / 2 - 10;
    tooltip.css('left', left + 'px');
    tooltip.css('top', top + 'px');

}
ViewerCanvas.prototype.onMouseOut = function() {
    let tooltip = this.tooltip;
    tooltip.hide();
}
/*
    drawScene
    Renders the scene onto the canvas.
 */
ViewerCanvas.prototype.drawScene = function() {
    let gl = this.gl;
    //gl.bindFramebuffer(gl.FRAMEBUFFER, this.composite_fb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(this.viewport.x, this.viewport.y, this.viewport.w,
        this.viewport.h);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1000);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for(let view of this.active_views) {
        view.drawScene(this);
    }
    //Draw crosshair, axis_label, and minimap
    this.drawCrosshair();
    this.drawAxisLabels();
    if(this.minimap_enabled) {
        this.drawMinimap();
    }
    /*
    //Draw the overlay onto the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    //Set up matrices
    mat4.identity(this.mv_matrix);
    mat4.translate(this.mv_matrix, this.mv_matrix, [0, 0, 0]);
    mat4.scale(this.mv_matrix, this.mv_matrix, [1, -1, 1]);
    //Set up shader parameters
    let shader = this.shdr.basic_tex;
    gl.useProgram(shader.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(shader.uniform['uAlpha'], 1.0);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, this.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.composite_tex);
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
    gl.drawArrays(gl.TRIANGLES, 0, this.pos_bf.item_n);*/
    requestAnimationFrame(this.drawScene.bind(this));
};
