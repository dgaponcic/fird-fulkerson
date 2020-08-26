(function (window) {


  // holds all our boxes
  var boxes2 = [];

  // New, holds the 8 tiny boxes that will be our selection handles
  // the selection handles will be in this order:
  // 0  1  2
  // 3     4
  // 5  6  7
  var selectionHandles = [];

  // Hold canvas information
  var canvas;
  var ctx;
  var WIDTH;
  var HEIGHT;
  var INTERVAL = 20;  // how often, in milliseconds, we check to see if a redraw is needed

  var isDrag = false;
  var isResizeDrag = false;
  var expectResize = -1; // New, will save the # of the selection handle if the mouse is over one.
  var mx, my; // mouse coordinates

  // when set to true, the canvas will redraw everything
  // invalidate() just sets this to false right now
  // we want to call invalidate() whenever we make a change
  var canvasValid = false;

  // The node (if any) being selected.
  // If in the future we want to select multiple objects, this will get turned into an array
  var mySel = [];
  var old = null;
  // The selection color and width. Right now we have a red selection with a small width
  var mySelColor = '#CC0000';
  var mySelWidth = 2;
  var mySelBoxColor = 'darkred'; // New for selection boxes
  var mySelBoxSize = 6;
  var count = 0;

  // we use a fake canvas to draw individual shapes for selection testing
  var ghostcanvas;
  var gctx; // fake canvas context

  // since we can drag from anywhere in a node
  // instead of just its x/y corner, we need to save
  // the offset of the mouse when we start dragging.
  var offsetx, offsety;

  // Padding and border style widths for mouse offsets
  var stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;




  // Box object to hold data
  function Box2() {
    this.x = 0;
    this.y = 0;
    this.w = 1; // default width and height?
    this.h = 1;
    this.fill = '#444444';
    this.nb = 0;
  }

  // New methods on the Box class
  Box2.prototype = {
    // we used to have a solo draw function
    // but now each box is responsible for its own drawing
    // mainDraw() will call this with the normal canvas
    // myDown will call this with the ghost canvas with 'black'
    draw: function (context, optionalColor) {
      if (context === gctx) {
        context.fillStyle = 'black'; // always want black for the ghost canvas
      } else {
        context.fillStyle = 'lightblue';
      }

      // We can skip the drawing of elements that have moved off the screen:
      if (this.x > WIDTH || this.y > HEIGHT) return;
      if (this.x + this.w < 0 || this.y + this.h < 0) return;

      context.fillRect(this.x, this.y, this.w, this.h);

      // draw selection
      // this is a stroke along the box and also 8 new selection handles
      if (mySel === this) {
        context.strokeStyle = mySelColor;
        context.lineWidth = mySelWidth;
        context.strokeRect(this.x, this.y, this.w, this.h);

        // draw the boxes

        var half = mySelBoxSize / 2;

        // 0  1  2
        // 3     4
        // 5  6  7

        // top left, middle, right
        selectionHandles[0].x = this.x - half;
        selectionHandles[0].y = this.y - half;

        selectionHandles[1].x = this.x + this.w / 2 - half;
        selectionHandles[1].y = this.y - half;

        selectionHandles[2].x = this.x + this.w - half;
        selectionHandles[2].y = this.y - half;

        //middle left
        selectionHandles[3].x = this.x - half;
        selectionHandles[3].y = this.y + this.h / 2 - half;

        //middle right
        selectionHandles[4].x = this.x + this.w - half;
        selectionHandles[4].y = this.y + this.h / 2 - half;

        //bottom left, middle, right
        selectionHandles[6].x = this.x + this.w / 2 - half;
        selectionHandles[6].y = this.y + this.h - half;

        selectionHandles[5].x = this.x - half;
        selectionHandles[5].y = this.y + this.h - half;

        selectionHandles[7].x = this.x + this.w - half;
        selectionHandles[7].y = this.y + this.h - half;


        context.fillStyle = mySelBoxColor;
        for (var i = 0; i < 8; i++) {
          var cur = selectionHandles[i];
          context.fillRect(cur.x, cur.y, mySelBoxSize, mySelBoxSize);
        }
      }

    } // end draw

  }

  lines = [];

  function addLine(box1, box2, capacity) {
    flow = 0;
    var line = { box1, box2, capacity, flow };
    lines.push(line);
  }

  //Initialize a new Box, add it, and invalidate the canvas
  function addRect(x, y, w, h, fill) {
    var rect = new Box2;
    rect.x = x;
    rect.y = y;
    rect.w = w
    rect.h = h;
    rect.fill = fill;
    rect.nb = count;
    count += 1;
    boxes2.push(rect);
    invalidate();
  }

  // initialize our canvas, add a ghost canvas, set draw loop
  // then add everything we want to intially exist on the canvas
  function init2() {
    canvas = document.getElementById('canvas2');
    HEIGHT = canvas.height;
    WIDTH = canvas.width;
    ctx = canvas.getContext('2d');
    ghostcanvas = document.createElement('canvas');
    ghostcanvas.height = HEIGHT;
    ghostcanvas.width = WIDTH;
    gctx = ghostcanvas.getContext('2d');

    //fixes a problem where double clicking causes text to get selected on the canvas
    canvas.onselectstart = function () { return false; }

    // fixes mouse co-ordinate problems when there's a border or padding
    // see getMouse for more detail
    if (document.defaultView && document.defaultView.getComputedStyle) {
      stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
      stylePaddingTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10) || 0;
      styleBorderLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10) || 0;
      styleBorderTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10) || 0;
    }

    // make mainDraw() fire every INTERVAL milliseconds
    setInterval(mainDraw, INTERVAL);

    // set our events. Up and down are for dragging,
    // double click is for making new boxes
    canvas.onmousedown = myDown;
    canvas.onmouseup = myUp;
    canvas.ondblclick = myDblClick;
    canvas.onmousemove = myMove;

    // set up the selection handle boxes
    for (var i = 0; i < 8; i++) {
      var rect = new Box2;
      selectionHandles.push(rect);
    }
  }


  function drawArrowhead(context, from, to, radius) {
    var x_center = to.x;
    var y_center = to.y + to.h / 2;

    var angle;
    var x;
    var y;

    context.beginPath();

    angle = Math.atan2(to.y - from.y, to.x - from.x)
    x = radius * Math.cos(angle) + x_center;
    y = radius * Math.sin(angle) + y_center;

    context.moveTo(x, y);

    angle += (1.0 / 3.0) * (2 * Math.PI)
    x = radius * Math.cos(angle) + x_center;
    y = radius * Math.sin(angle) + y_center;

    context.lineTo(x, y);

    angle += (1.0 / 3.0) * (2 * Math.PI)
    x = radius * Math.cos(angle) + x_center;
    y = radius * Math.sin(angle) + y_center;

    context.lineTo(x, y);

    context.closePath();

    context.fill();
    context.stroke()
  }

  //wipes the canvas context
  function clear(c) {
    c.clearRect(0, 0, WIDTH, HEIGHT);
  }

  // Main draw loop.
  // While draw is called as often as the INTERVAL variable demands,
  // It only ever does something if the canvas gets invalidated by our code
  function mainDraw() {
    if (canvasValid == false) {
      clear(ctx);

      // Add stuff you want drawn in the background all the time here

      // draw all boxes
      var l = boxes2.length;
      for (var i = 0; i < l; i++) {
        boxes2[i].draw(ctx); // we used to call drawshape, but now each box draws itself
        ctx.font = '18px serif';
        ctx.fillStyle = "#000000";
        ctx.fillText(`${boxes2[i].nb}`, boxes2[i].w / 2 + boxes2[i].x, boxes2[i].h / 2 + boxes2[i].y);
      }
      var l = lines.length;
      for (var i = 0; i < l; i++) {
        if (lines[i].flow != lines[i].capacity)
          ctx.strokeStyle = '#000000';
        else
          ctx.strokeStyle = '#f00';
        ctx.beginPath();
        if (Math.abs(lines[i].box1.x - lines[i].box2.x) < 100) {
          xArr = lines[i].box1.x + 0.5 * lines[i].box1.w;
          if (lines[i].box1.y - lines[i].box2.y > 0)
            yArr = lines[i].box1.y
          else
            yArr = lines[i].box1.y + lines[i].box1.h
        }
        else if (lines[i].box1.x + lines[i].box1.w > lines[i].box2.x) {
          xArr = lines[i].box1.x;
          yArr = lines[i].box1.y + lines[i].box1.h / 2
        }
        else {
          xArr = lines[i].box1.x + lines[i].box1.w,
            yArr = lines[i].box1.y + lines[i].box1.h / 2
        }

        ctx.moveTo(xArr, yArr);
        ctx.lineTo(lines[i].box2.x, lines[i].box2.y + lines[i].box2.h / 2);
        ctx.stroke();
        ctx.font = '18px serif';
        ctx.fillStyle = "#000000";
        ctx.fillText(`${lines[i].flow}/${lines[i].capacity}`, (lines[i].box1.x + lines[i].box2.x) / 2, (lines[i].box1.y + lines[i].box2.y) / 2);
        drawArrowhead(ctx, lines[i].box1, lines[i].box2, 5)
        ctx.fillText(`flow: ${flow}`, 1400, 50)
      }
      // Add stuff you want drawn on top all the time here

      canvasValid = true;
    }
  }

  // Happens when the mouse is moving inside the canvas
  function myMove(e) {
    if (isDrag) {
      getMouse(e);

      mySel.x = mx - offsetx;
      mySel.y = my - offsety;

      // something is changing position so we better invalidate the canvas!
      invalidate();
    } else if (isResizeDrag) {
      // time ro resize!
      var oldx = mySel.x;
      var oldy = mySel.y;

      // 0  1  2
      // 3     4
      // 5  6  7
      switch (expectResize) {
        case 0:
          mySel.x = mx;
          mySel.y = my;
          mySel.w += oldx - mx;
          mySel.h += oldy - my;
          break;
        case 1:
          mySel.y = my;
          mySel.h += oldy - my;
          break;
        case 2:
          mySel.y = my;
          mySel.w = mx - oldx;
          mySel.h += oldy - my;
          break;
        case 3:
          mySel.x = mx;
          mySel.w += oldx - mx;
          break;
        case 4:
          mySel.w = mx - oldx;
          break;
        case 5:
          mySel.x = mx;
          mySel.w += oldx - mx;
          mySel.h = my - oldy;
          break;
        case 6:
          mySel.h = my - oldy;
          break;
        case 7:
          mySel.w = mx - oldx;
          mySel.h = my - oldy;
          break;
      }

      invalidate();
    }

    getMouse(e);
    // if there's a selection see if we grabbed one of the selection handles
    if (mySel !== null && !isResizeDrag) {
      for (var i = 0; i < 8; i++) {
        // 0  1  2
        // 3     4
        // 5  6  7

        var cur = selectionHandles[i];

        // we dont need to use the ghost context because
        // selection handles will always be rectangles
        if (mx >= cur.x && mx <= cur.x + mySelBoxSize &&
          my >= cur.y && my <= cur.y + mySelBoxSize) {
          expectResize = i;
          invalidate();

          switch (i) {
            case 0:
              this.style.cursor = 'nw-resize';
              break;
            case 1:
              this.style.cursor = 'n-resize';
              break;
            case 2:
              this.style.cursor = 'ne-resize';
              break;
            case 3:
              this.style.cursor = 'w-resize';
              break;
            case 4:
              this.style.cursor = 'e-resize';
              break;
            case 5:
              this.style.cursor = 'sw-resize';
              break;
            case 6:
              this.style.cursor = 's-resize';
              break;
            case 7:
              this.style.cursor = 'se-resize';
              break;
          }
          return;
        }

      }
      // not over a selection box, return to normal
      isResizeDrag = false;
      expectResize = -1;
      this.style.cursor = 'auto';
    }

  }

  // Happens when the mouse is clicked in the canvas
  function myDown(e) {
    getMouse(e);

    //we are over a selection box
    if (expectResize !== -1) {
      isResizeDrag = true;
      return;
    }

    clear(gctx);
    var l = boxes2.length;
    for (var i = l - 1; i >= 0; i--) {
      // draw shape onto ghost context
      boxes2[i].draw(gctx, 'black');

      // get image data at the mouse x,y pixel
      var imageData = gctx.getImageData(mx, my, 1, 1);
      var index = (mx + my * imageData.width) * 4;

      // if the mouse pixel exists, select and break
      if (imageData.data[3] > 0) {
        old = mySel
        mySel = boxes2[i];
        offsetx = mx - mySel.x;
        offsety = my - mySel.y;
        mySel.x = mx - offsetx;
        mySel.y = my - offsety;
        isDrag = true;

        invalidate();
        clear(gctx);
        return;
      }

    }
    // havent returned means we have selected nothing
    mySel = null;
    // clear the ghost canvas for next time
    clear(gctx);
    // invalidate because we might need the selection border to disappear
    invalidate();
  }

  function myUp() {
    if (mySel && old) {
      var capacity = prompt("Enter capacity");
      if (capacity)
        addLine(old, mySel, capacity)
      old = mySel = null
      clear(gctx)
      mainDraw()
    }
    isDrag = false;
    isResizeDrag = false;
    expectResize = -1;
  }

  // adds a new node
  function myDblClick(e) {
    getMouse(e);
    // for this method width and height determine the starting X and Y, too.
    // so I left them as vars in case someone wanted to make them args for something and copy this code
    var width = 60;
    var height = 60;
    button = document.getElementById('getSol');
    if (button.style.visibility != 'hidden')
      addRect(mx - (width / 2), my - (height / 2), width, height, 'rgba(220,205,65,0.7)');
  }


  function invalidate() {
    canvasValid = false;
  }

  // Sets mx,my to the mouse position relative to the canvas
  // unfortunately this can be tricky, we have to worry about padding and borders
  function getMouse(e) {
    var element = canvas, offsetX = 0, offsetY = 0;

    if (element.offsetParent) {
      do {
        offsetX += element.offsetLeft;
        offsetY += element.offsetTop;
      } while ((element = element.offsetParent));
    }

    // Add padding and border style widths to offset
    offsetX += stylePaddingLeft;
    offsetY += stylePaddingTop;

    offsetX += styleBorderLeft;
    offsetY += styleBorderTop;

    mx = e.pageX - offsetX;
    my = e.pageY - offsetY
  }

  window.init2 = init2;
})(window);

$(document).ready(function () {
  init2();
});


count = 0;
var res = []

function setValues(data) {
  res = data;
}

function getSol() {
  button = document.getElementById('getSol');
  button.style.visibility = 'hidden';
  next = document.getElementById('next');
  next.style.visibility = 'visible'
  source = prompt("Enter source");
  sink = prompt("Enter sink");
  if (!source || !sink) return
  var l = lines.length;
  input = [];
  for (var i = 0; i < l; i++) {
    input.push({ from: lines[i].box1.nb, to: lines[i].box2.nb, capacity: lines[i].capacity })
  }
  data = { input, source, sink }
  return fetch("http://127.0.0.1:8000/sendRes", {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (myJson) {
      let output = JSON.parse(myJson);
      setValues(output)
    });
}

count = 0;

flow = 0
function getNext() {
  if (count >= res.length) {
    next = document.getElementById('next');
    next.style.visibility = 'hidden';
    return;
  }
  else {
    var sol = res[count];
    flow = sol["flow"];
    var path = sol.path
    var reserve = sol["reserve"]
    for (i = 0; i < path.length - 1; i++) {
      for (j = 0; j < lines.length; j++) {
        if (lines[j].box1.nb == path[i] && lines[j].box2.nb == path[i + 1])
          lines[j].flow += reserve;
        if (lines[j].box2.nb == path[i] && lines[j].box1.nb == path[i + 1])
          lines[j].flow -= reserve;
      }
    }
    count += 1;
  }
}
