function ViewerLabelPanel(view, canvas) {
    ViewerSingleImagePanel.call(this, view, canvas);
    this.draw_contours = false;
};
ViewerLabelPanel.prototype = Object.create(ViewerSingleImagePanel.prototype);
ViewerLabelPanel.prototype.buildTemplateURL = function(url_start,
        slice_index) {
    return [url_start, 'label', this.view.submodality]
        .concat([this.canvas.axis, String(slice_index)])
        .join('/');
};
ViewerLabelPanel.prototype.buildPreviewTemplateURL = function(url_start,
        slice_index) {
    return [url_start, 'label', this.view.submodality]
        .concat([this.canvas.axis, String(slice_index), 'preview'])
        .join('/');
};
ViewerLabelPanel.prototype.buildContourURL = function(url_start, slice_index) {
    return [url_start, 'contour', this.view.submodality]
        .concat([this.canvas.axis, String(slice_index)])
        .join('/');
}
ViewerLabelPanel.prototype.getSlice = function(slice_index) {
    if(slice_index in this.slices) {
        return this.slices[slice_index];
    }
    if(this.slice_holes.has(slice_index) || this.view.empty) {
        return null;
    }
    let url_start = '/smda/i/' + this.view.context.subject_id;
    let url = this.buildTemplateURL(url_start, slice_index);
    let preview_url = this.buildPreviewTemplateURL(url_start, slice_index);
    let contour_url = this.buildContourURL(url_start, slice_index);
    let slice = this.slices[slice_index] = {
        index: slice_index,
        image: new ViewImage(this, this.view.key + ':' + slice_index, url),
        preview: new ViewImage(this, this.view.key + ':' + slice_index +
            ':preview', preview_url),
        contours: new ViewContours(this, this.view.key + ':' + slice_index,
            contour_url)
    };
    return slice;
}
ViewerLabelPanel.prototype.onMousePoint = function(px, py) {
    let slice = this.getSlice(this.slice);
    if(!slice || !slice.contours.is_ready) {
        return;
    }
    if(slice.contours.map === null) {
        return;
    }
    let tooltip = this.canvas.tooltip;
    let name = this.testPoint(slice.contours.map, px, py);
    if(name) {
        tooltip.show();
        tooltip.text(name);
    }
    else {
        tooltip.hide();
    }
}
ViewerLabelPanel.prototype.testPoint = function(contours, px, py) {
    //console.log('test ' + px + ' ' + py);
    for(let name in contours) {
        let polygons = contours[name];
        let point = [px, py];
        //console.log('n polygons ' + polygons.length);
        for(let i = 0; i < polygons.length; i++) {
            let polygon = polygons[i];
            //console.log('polygon ' + JSON.stringify(polygon));
            let inside = this.isInside(polygon, point);
            if(inside) {
                return name;
            }
        }
    }
    return null;
}
// Returns true if the point p lies inside the polygon[] with n vertices
ViewerLabelPanel.prototype.isInside = function(polygon, p) {
    let n = polygon.length;
    // There must be at least 3 vertices in polygon[]
    if (n < 3) return false;
    // Create a point for line segment from p to infinite
    let extreme = [1000, p[1]];
    // Count intersections of the above line with sides of polygon
    let count = 0;
    let i = 0;
    do {
        let next = (i + 1) % n;
        // Check if the line segment from 'p' to 'extreme' intersects
        // with the line segment from 'polygon[i]' to 'polygon[next]'
        if (this.doIntersect(polygon[i], polygon[next], p, extreme)) {
            // If the point 'p' is colinear with line segment 'i-next',
            // then check if it lies on segment. If it lies, return true,
            // otherwise false
            if (this.orientation(polygon[i], p, polygon[next]) == 0)
               return this.onSegment(polygon[i], p, polygon[next]);
            count++;
        }
        i = next;
    } while (i != 0);
    // Return true if count is odd, false otherwise
    return count & 1;  // Same as (count % 2 == 1)
}
// The function that returns true if line segment 'p1q1'
// and 'p2q2' intersect.
ViewerLabelPanel.prototype.doIntersect = function(p1, q1, p2, q2) {
    // Find the four orientations needed for general and
    // special cases
    let o1 = this.orientation(p1, q1, p2);
    let o2 = this.orientation(p1, q1, q2);
    let o3 = this.orientation(p2, q2, p1);
    let o4 = this.orientation(p2, q2, q1);
    // General case
    if(o1 != o2 && o3 != o4) {
        return true;
    }
    // Special Cases
    // p1, q1 and p2 are colinear and p2 lies on segment p1q1
    if(o1 == 0 && this.onSegment(p1, p2, q1)) {
        return true;
    }
    // p1, q1 and p2 are colinear and q2 lies on segment p1q1
    if(o2 == 0 && this.onSegment(p1, q2, q1)) {
        return true;
    }
    // p2, q2 and p1 are colinear and p1 lies on segment p2q2
    if(o3 == 0 && this.onSegment(p2, p1, q2)) {
        return true;
    }
     // p2, q2 and q1 are colinear and q1 lies on segment p2q2
    if(o4 == 0 && this.onSegment(p2, q1, q2)) {
        return true;
    }
    return false; // Doesn't fall in any of the above cases
}
// To find orientation of ordered triplet (p, q, r).
// The function returns following values
// 0 --> p, q and r are colinear
// 1 --> Clockwise
// 2 --> Counterclockwise
ViewerLabelPanel.prototype.orientation = function(p, q, r) {
    let val = (q[1] - p[1]) * (r[0] - q[0]) -
              (q[0] - p[0]) * (r[1] - q[1]);
    if (val == 0) return 0;  // colinear
    return (val > 0) ? 1 : 2; // clock or counterclock wise
}
// Given three colinear points p, q, r, the function checks if
// point q lies on line segment 'pr'
ViewerLabelPanel.prototype.onSegment = function(p, q, r) {
    if (q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
            q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]))
        return true;
    return false;
}
ViewerLabelPanel.prototype.draw = function() {
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
    mat4.scale(this.mv_matrix, this.mv_matrix, [xscale, yscale, 1]);
    mat4.rotate(this.mv_matrix, this.mv_matrix, angle, [0, 0, 1]);
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
    gl.bindTexture(gl.TEXTURE_2D, null);
    //Draw the contours
    if(!this.draw_contours) {
        return;
    }
    if(slice.contours.contour_bf === null) {
        return;
    }
    shader = canvas.shdr.color;
    gl.useProgram(shader.program);
    mat4.identity(this.mv_matrix);
    mat4.translate(this.mv_matrix, this.mv_matrix,
        [-pan_x * scale, -pan_y * scale, 0]);
    mat4.scale(this.mv_matrix, this.mv_matrix, [xscale, yscale, 1]);
    gl.uniform4fv(shader.uniform['vColor'], [1.0, 1.0, 1.0, 1.0]);
    gl.uniformMatrix4fv(shader.uniform['uPMatrix'], false, canvas.p_matrix);
    gl.uniformMatrix4fv(shader.uniform['uMVMatrix'], false, this.mv_matrix);
    for(let name in slice.contours.contour_bf) {
        let contour_bfs = slice.contours.contour_bf[name];
        for(let contour_bf of contour_bfs) {
            gl.bindBuffer(gl.ARRAY_BUFFER, contour_bf);
            gl.enableVertexAttribArray(shader.attrib['aPosition']);
            gl.vertexAttribPointer(shader.attrib['aPosition'],
                contour_bf.item_sz, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINE_STRIP, 0, contour_bf.item_n);
        }
    }
};

