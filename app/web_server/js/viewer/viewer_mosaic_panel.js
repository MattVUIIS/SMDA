function ViewerMosaicPanel(view, canvas) {
    ViewerPanel.call(this, view, canvas);
};
ViewerMosaicPanel.prototype = Object.create(ViewerPanel.prototype);
ViewerMosaicPanel.prototype.buildMosaicTemplateURL = function(url_start,
        slice_index, row, col) {
    return '';
}
ViewerMosaicPanel.prototype.getSlice = function(slice_index) {
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
        'url': url,
        mosaic: {},
        preview: new ViewImage(this, this.view.key + ':' + slice_index +
            ':preview', preview_url),
    };
    return slice;
}
/*
    getBSTBin
    Gets the bin that the given coordinate should be placed in
    the binary space partitioning tree
*/
ViewerMosaicPanel.prototype.getBSTBin = function(x, y, area_width, area_height,
        shift, level_n) {
    let x_pivot = shift + area_width / (2 << level_n);
    let y_pivot = shift + area_height / (2 << level_n);
    let [bst_xaddr, bst_yaddr] = [0, 0];
    for(let level = 1; level <= level_n; level += 1) {
        bst_xaddr = bst_xaddr << 1 | (x > x_pivot);
        x_pivot += area_width / (2 << level) * (x > x_pivot ? 1 : -1);
        bst_yaddr = bst_yaddr << 1 | (y > y_pivot);
        y_pivot += area_height / (2 << level) * (y > y_pivot ? 1 : -1);
    }
    return [bst_xaddr + 1, bst_yaddr + 1];
}
ViewerMosaicPanel.prototype.draw = function() {
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
    if(!slice) {
        view.onLoadingImage();
        return;
    }
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(shader.program);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, canvas.p_matrix);
    //Get the attributes
    let attrib = this.attrib;
    let scale = (context[canvas.axis_prefix + 'scale'] *
        context[canvas.axis_prefix + 'magnification'] / view.max_row);
    let xscale = (attrib && ('horizontal_flip' in attrib) ? -scale : scale)
        * (attrib && ('xscale' in attrib) ? attrib.xscale : 1);
    let yscale = (attrib && ('vertical_flip' in attrib) ? -scale : scale)
        * (attrib && ('yscale' in attrib) ? attrib.yscale : 1);
    let [xsign, ysign] = [Math.sign(xscale), Math.sign(yscale)];
    let [pan_x, pan_y] = [context.pan_x * view.max_col,
        context.pan_y * view.max_row];
    //For binary space tree calculation, we need each of the corners
    //of the view area multiplied by the level of the BST
    let bst_level = Math.log2(view.max_row);
    let bst_factor = Math.pow(2, bst_level);
    let view_left = canvas.view_left * bst_factor;
    let view_bottom = canvas.view_bottom * bst_factor;
    let view_right = canvas.view_right * bst_factor;
    let view_top = canvas.view_top * bst_factor;
    //Rotate the four corners of the view area by the negative of the
    //angle attribute
    let view_rect = [[view_left, view_bottom], [view_left, view_top],
        [view_right, view_bottom], [view_right, view_top]];
    let angle = attrib && ('rotate' in attrib) ? attrib['rotate'] : 0;
    if(angle) {
        let cos_neg_angle = Math.cos(-angle);
        let sin_neg_angle = Math.sin(-angle);
        view_rect = view_rect.map(([x, y]) => [
            x * cos_neg_angle - y * sin_neg_angle,
            x * sin_neg_angle + y * cos_neg_angle,
        ]);
    }
    //Every row and column within the view area should be drawn.
    //We take the y coordinate to be negative since the positive Y axis in
    //OpenGL is up, while the BST algorithm assumes that it is down.
    //Get the extremities of the bins and draw the rectangular area.
    let area_width = canvas.ortho_xspan * view.max_col;
    let area_height = canvas.ortho_yspan * view.max_row;
    let bins = view_rect.map(([x, y]) => this.getBSTBin(x, -y, area_width,
        area_height, canvas.ortho_xoffset, bst_level));
    let bin_x = bins.map((p) => p[0]);
    let bin_y = bins.map((p) => p[1]);
    let left = Math.min(...bin_x);
    let right = Math.max(...bin_x);
    let bottom = Math.min(...bin_y);
    let top = Math.max(...bin_y);
    //Calculate the stride with the visible area
    let visible_block_area = ((view_top - view_bottom + 1)
        * (view_right - view_left + 1));
    let stride = 1;
    while(view.panel_opt && visible_block_area / stride > view.panel_opt.max_visible_area) {
        stride += 1;
    }
    /*console.log(formattedReport('', [
            {'visible_block_area': visible_block_area, 'stride': stride},
            {'left': left, 'bottom': bottom, 'right': right, 'top': top},
            {'area_width': area_width, 'area_height': area_height},
        ]));*/
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shader.uniform['uSampler'], 0);
    gl.uniform1f(shader.uniform['uAlpha'], view.alpha / context.max_alpha);
    let [cos_angle, sin_angle] = [Math.cos(angle), Math.sin(angle)];
    let rotate_by_angle = ([x, y]) => [
        x * cos_angle - y * sin_angle,
        x * sin_angle + y * cos_angle,
    ];
    gl.enableVertexAttribArray(shader.attrib['aPosition']);
    gl.enableVertexAttribArray(shader.attrib['aTexCoord']);
    let level_mosaic = slice.mosaic[context.level];
    if(!level_mosaic) {
        level_mosaic = slice.mosaic[context.level] = {};
    }
    let first_row = Math.ceil(bottom / stride) * stride;
    let last_row = top;
    let first_col = Math.ceil(left / stride) * stride;
    let last_col = right;
    let missing_glyphs = false;
    let loading_glyphs = false;
    for(let row = first_row; row <= last_row; row += stride) {
        let norm_y = -(canvas.ortho_yspan * (row - view.center_row)
            + canvas.ortho_yoffset)
        for(let col = first_col; col <= last_col; col += stride) {
            let img_row = ysign == 1 ? row : view.max_row - row + 1;
            let img_col = xsign == 1 ? col : view.max_col - col + 1;
            if((view.row_holes && view.row_holes.has(img_row))
                    || (view.holes && view.holes.has([img_col, img_row]))) {
                continue;
            }
            let coord = [img_col, img_row];
            let mosaic_piece = level_mosaic[coord];
            if(!mosaic_piece) {
                let name = view.key + ':' + slice.index + ':' + coord;
                let piece_url = this.buildMosaicTemplateURL(slice.url,
                    this.slice, row, col);
                mosaic_piece = level_mosaic[coord] = new ViewImage(this, name,
                    piece_url);
            }
            if(!mosaic_piece.is_ready) {
                loading_glyphs |= true;
                continue;
            }
            if(mosaic_piece.tex === null) {
                missing_glyphs |= true;
                continue;
            }
            let norm_x = canvas.ortho_xspan * (col - view.center_col)
                + canvas.ortho_xoffset;
            let [x, y] = rotate_by_angle([norm_x, norm_y]);
            mat4.identity(this.mv_matrix);
            mat4.translate(this.mv_matrix, this.mv_matrix,
                [(x - pan_x) * scale, (y - pan_y) * scale, 0]);
            mat4.rotate(this.mv_matrix, this.mv_matrix, angle, [0, 0, 1]);
            mat4.scale(this.mv_matrix, this.mv_matrix,
                [xscale * stride, yscale * stride, 1]);
            gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false,
                this.mv_matrix);
            gl.bindTexture(gl.TEXTURE_2D, mosaic_piece.tex);
            //Prepare the position attribute pointer
            gl.bindBuffer(gl.ARRAY_BUFFER, this.pos_bf);
            gl.vertexAttribPointer(shader.attrib['aPosition'],
                this.pos_bf.item_sz, gl.FLOAT, false, 0, 0);
            //Prepare the texture attribute pointer
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoord_bf);
            gl.vertexAttribPointer(shader.attrib['aTexCoord'],
                this.texcoord_bf.item_sz, gl.FLOAT, false, 0, 0);
            if(view.modality == 'hist') {
                //console.log('histology draw ' + this.pos_bf.item_n);
            }
            //Draw the ABO as a triangle strip
            gl.drawArrays(gl.TRIANGLES, 0, this.pos_bf.item_n);
        }
    }
    gl.disableVertexAttribArray(shader.attrib['aTexCoord']);
    if(loading_glyphs) {
        view.onLoadingImage();
    }
    else if(missing_glyphs) {
        view.onMissingImage();
    }
    else {
        view.onLoadedImage();
    }
};
