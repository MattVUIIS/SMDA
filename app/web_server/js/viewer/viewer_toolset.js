/*
    Encapsulates the controls for the viewer's tools such as pan, crosshair, etc.
    This class has a dependency on jQuery
*/
function ViewerToolset(context) {
    this.context = context;
    //this.canvas = $(context.elCanvas);
    this.body = $(document.body);
    this.active_tool = null;
}
ViewerToolset.prototype.isActiveTool = function(tool) {
    return this.active_tool === tool;
}
ViewerToolset.prototype.activateCrosshairTool = function() {
    //console.log('Crosshair tool activated');
    this.active_tool = 'crosshair';
    let toolset = this;
    let context = this.context;
    //Have to create closures for each panel here because we need to
    //bind the 'panel' variable to each scope to work correctly
    for(let name in context.canvas) {
        (function(canvas) {
            let element = canvas.element;
            //console.log('activateCrosshairTool ' + canvas.axis);
            element.removeClass('cursorPan');
            element.removeClass('cursorPanning');
            element.removeClass('cursorZoomIn');
            element.removeClass('cursorZoomOut');
            element.addClass('cursorCrosshair');
            toolset._setCrosshairToolForCanvas(canvas);
        })(context.canvas[name]);
    };
    this.body.off('mouseup');
    this.body.mouseup(function() {
        for(let name in context.canvas) {
            (function(canvas) {
                canvas.element.off('mousemove', canvas._crosshairTrack);
            })(context.canvas[name]);
        }
    });
};
ViewerToolset.prototype.centerCrosshair = function() {
    this.context.crosshairCenter();
}
ViewerToolset.prototype.centerPan = function() {
    this.context.panCenter('coronal');
    this.context.panCenter('axial');
    this.context.panCenter('sagittal');
}
ViewerToolset.prototype._setCrosshairToolForCanvas = function(canvas) {
    let context = this.context;
    let element = canvas.element;
    element.off();
    canvas._crosshairTrack = function() {
        context.setCrosshair(canvas, canvas.mos_pos.x, canvas.mos_pos.y);
    };
    element.mousemove(canvas.onDefaultMouseMove.bind(canvas));
    element.mouseout(canvas.onDefaultMouseOut.bind(canvas));
    element.mousedown(function(event) {
        //canvas.onDefaultMouseMove(event);
        context.setCrosshair(canvas, canvas.mos_pos.x, canvas.mos_pos.y);
        element.mousemove(canvas.onDefaultMouseMove.bind(canvas));
        element.mousemove(canvas._crosshairTrack);
    });
    this.setScrollWheelZoom(canvas);
};
ViewerToolset.prototype.activatePanTool = function() {
    //console.log("Pan tool activated");
    this.active_tool = 'pan';
    let toolset = this;
    let context = this.context;
    //Have to create closures for each canvas here because we need to
    //bind the 'canvas' variable to each scope to work correctly
    for(let name in context.canvas) {
        (function(canvas) {
            canvas.element.removeClass('cursorCrosshair');
            canvas.element.removeClass('cursorZoomIn');
            canvas.element.removeClass('cursorZoomOut');
            canvas.element.addClass('cursorPan');
            toolset._setPanToolForCanvas(canvas)
        })(context.canvas[name]);
    }
    //Creating closures here too for reasons stated above
    this.body.off('mouseup');
    this.body.mouseup(function() {
        //console.log('mouseup');
        for(let name in context.canvas) {
            (function(canvas) {
                canvas.element.removeClass('cursorPanning');
                canvas.element.off('mousemove', canvas._panTrack);
                canvas.element.off('mousemove', canvas._minimapPanTrack);
            })(context.canvas[name]);
        }
    });
};
ViewerToolset.prototype._setPanToolForCanvas = function(canvas) {
    let context = this.context;
    let element = canvas.element;
    element.off();
    //Move the mouse to pan
    canvas._panTrack = function() {
        let delta_x = (canvas.prev_mos_pos.x - canvas.mos_pos.x);
        let delta_y = (canvas.prev_mos_pos.y - canvas.mos_pos.y);
        context.addPan(canvas.axis, delta_x, delta_y);
        Object.assign(canvas.prev_mos_pos, canvas.mos_pos);
    };
    //Move the mouse to drag
    canvas._minimapTrack = function() {
        let [left, bottom] = [0, 0];
        if(canvas.minimap_enabled) {
            //console.log('pan mousedown on: ' + panel.name);
            //console.log('mouse pos: ' + JSON.stringify(canvas.mos_pos));
            left = canvas.ortho.right - canvas.ortho_xspan * canvas.minimap_size;
            bottom = canvas.ortho.top - canvas.ortho_yspan * canvas.minimap_size;
        }
        //console.log('left ' + left + ' bottom ' + bottom);
        if(canvas.minimap_enabled && canvas.mos_pos.x >= left && canvas.mos_pos.y >= bottom) {
            element.removeClass('cursorPan');
            element.addClass('pointer');
        }
        else {
            element.addClass('cursorPan');
            element.removeClass('pointer');
        }
    };
    element.mousemove(canvas.onDefaultMouseMove.bind(canvas));
    element.mouseout(canvas.onDefaultMouseOut.bind(canvas));
    element.mousemove(canvas._minimapTrack);
    //Click to start pan or jump to the location in the minimap
    canvas._minimapPanTrack = function() {
        let [left, bottom] = [0, 0];
        if(canvas.minimap_enabled) {
            //console.log('pan mousedown on: ' + panel.name);
            //console.log('mouse pos: ' + JSON.stringify(canvas.mos_pos));
            left = canvas.ortho.right - canvas.ortho_xspan * canvas.minimap_size;
            bottom = canvas.ortho.top - canvas.ortho_yspan * canvas.minimap_size;
        }
        //console.log('left ' + left + ' bottom ' + bottom);
        if(canvas.minimap_enabled && canvas.mos_pos.x >= left && canvas.mos_pos.y >= bottom) {
            let pos_x = canvas.ortho_xoffset + (canvas.mos_pos.x - left) /
                canvas.minimap_size * canvas.ortho_xspan;
            let pos_y = canvas.ortho_yoffset + (canvas.mos_pos.y - bottom) /
                canvas.minimap_size * canvas.ortho_yspan;
            context.setPan(canvas.axis, pos_x, pos_y);
        }
    };
    element.mousedown(function() {
        let [left, bottom] = [0, 0];
        Object.assign(canvas.prev_mos_pos, canvas.mos_pos);
        if(canvas.minimap_enabled) {
            //console.log('pan mousedown on: ' + panel.name);
            //console.log('mouse pos: ' + JSON.stringify(canvas.mos_pos));
            left = canvas.ortho.right - canvas.ortho_xspan * canvas.minimap_size;
            bottom = canvas.ortho.top - canvas.ortho_yspan * canvas.minimap_size;
        }
        //console.log('left ' + left + ' bottom ' + bottom);
        if(canvas.minimap_enabled && canvas.mos_pos.x >= left && canvas.mos_pos.y >= bottom) {
            /*element.addClass('cursorPanning');
            element.mousemove(panel._minimapPanTrack);*/
            let pos_x = canvas.ortho_xoffset + (canvas.mos_pos.x - left) /
                canvas.minimap_size * canvas.ortho_xspan;
            let pos_y = canvas.ortho_yoffset + (canvas.mos_pos.y - bottom) /
                canvas.minimap_size * canvas.ortho_yspan;
            context.setPan(canvas.axis, pos_x, pos_y);
            element.mousemove(canvas._minimapPanTrack);
        }
        else {
            element.addClass('cursorPanning');
            element.mousemove(canvas._panTrack);
        }
    });
    this.setScrollWheelZoom(canvas);
};
ViewerToolset.prototype.setScrollWheelZoom = function(canvas) {
    let context = this.context;
    //Scroll wheel zoom
    canvas.element.mousewheel(function(event) {
        let [left, bottom] = [0, 0];
        if(canvas.minimap_enabled) {
            left = canvas.ortho.right - canvas.ortho_xspan * canvas.minimap_size;
            bottom = canvas.ortho.top - canvas.ortho_yspan * canvas.minimap_size;
        }
        if(canvas.minimap_enabled && canvas.mos_pos.x >= left && canvas.mos_pos.y >= bottom) {
            //Scroll slices
            if(event.deltaY > 0) {
                context.incrementSlice(canvas.axis);
            }
            else if(event.deltaY < 0) {
                context.decrementSlice(canvas.axis);
            }
        }
        else { //Zoom
            if(event.deltaY > 0) {
                context.incrementZoom(canvas.axis);
            }
            else if(event.deltaY < 0) {
                context.decrementZoom(canvas.axis);
            }
        }
        return false;
    });
};
ViewerToolset.prototype.activateMinimapTool = function() {
    this.context.toggleMinimap();
}
ViewerToolset.prototype.activateZoomInTool = function() {
    //console.log('Zoom in tool activated');
    this.active_tool = 'zoom_in';
    let toolset = this;
    let context = this.context;
    //Have to create closures for each canvas here because we need to
    //bind the 'canvas' variable to each scope to work correctly
    for(let name in context.canvas) {
        (function(canvas) {
            //console.log('activateZoomInTool ' + canvas.axis);
            let element = canvas.element;
            element.removeClass('cursorPan');
            element.removeClass('cursorPanning');
            element.removeClass('cursorCrosshair');
            element.removeClass('cursorZoomOut');
            element.addClass('cursorZoomIn');
            element.off();
            element.mousedown(function(event) {
                context.incrementZoom(canvas.axis);
            });
            toolset.setScrollWheelZoom(canvas);
        })(context.canvas[name]);
    };
}
ViewerToolset.prototype.activateZoomOutTool = function() {
    //console.log('Zoom out tool activated');
    this.active_tool = 'zoom_out';
    let toolset = this;
    let context = this.context;
    //Have to create closures for each canvas here because we need to
    //bind the 'canvas' variable to each scope to work correctly
    for(let name in context.canvas) {
        (function(canvas) {
            //console.log('activateZoomOutTool ' + canvas.axis);
            let element = canvas.element;
            element.removeClass('cursorPan');
            element.removeClass('cursorPanning');
            element.removeClass('cursorCrosshair');
            element.removeClass('cursorZoomIn');
            element.addClass('cursorZoomOut');
            element.off();
            element.mousedown(function(event) {
                context.decrementZoom(canvas.axis);
            });
            toolset.setScrollWheelZoom(canvas);
        })(context.canvas[name]);
    };
}
/*
    _processPageCoordinates
    Gets the correct position of the mouse with respect to the page element
*/
ViewerToolset.prototype._processPageCoordinates = function(event) {
    event = event || window.event;
    if(event.pageX == null && event.clientX != null) {
        let eventDoc = (event.target && event.target.ownerDocument) || document;
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
ViewerToolset.prototype.initialize = function() {
    this.activateCrosshairTool();
}
