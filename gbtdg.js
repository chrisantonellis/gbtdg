
/* -----------------------------------------------------------------------------
 * Gameboy Tile Data Generator
 * gbtdg.js v1.3.1
 * 2014 Chris Antonellis
 *
 * GameBoy Tile Data Generator is a HTML5 / JS web application that will convert
 * bitmap images to hexidecimal data appropriate for use in tile based
 * graphical applications, specifically Nintendo Gameboy (DMG) software.
 *
 * Nintendo and GameBoy are registered trademarks of Nintendo, Inc.
 * Nintendo, Inc. has not authorized, approved of, or licensed this application.
 * -------------------------------------------------------------------------- */

 // TODO
 // - cache quanized tile data

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Constants                                                                  //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

// Input File
var max_filesize = 128 * 1024;
var max_width = 512;
var max_height = 512;
var max_map_length = 256;

// Gameboy
var tile_pw = 8;
var tile_ph = 8;
var canvas_width = 160;
var canvas_height	= 144;

// GBTDG
var advanced_options_text_show = "Show Advanced Options";
var advanced_options_text_hide = "Hide Advanced Options";
var advanced_options_duration = 300;
var text_page_duration = 200;

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Variables                                                                  //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

// Input File
var file_name;
var file_name_clean;
var file_size;

var image_pw;	// Pixel Width
var image_ph;	// Pixel Height
var image_pc;	// Pixel Count

var image_tw;	// Tile Width
var image_th;	// Tile Height
var image_tc;	// Tile Count

// Data Generation Options
var o_tile_data	= "checked";
var o_tile_map = "checked";
var o_tile_quan	= "checked";
var o_pad_map = null;
var o_asm_format = "checked";
var o_c_format = null;

var o_c_style = null;

// Output Generation Options
var o_comment = "; ";
var o_line_begin = "DB ";
var o_line_end = "";
var o_hex_prefix = "$";
var o_var_equals = "EQU";
var o_var_char = "";
var o_var_int = "";
var o_array_begin = "";
var o_array_end = "";
var o_array_line_end = "";

// Pad Map Data Options
var o_pad_map_w = "32";
var o_pad_map_h = "32";
var o_pad_map_v = "00";

// Output File
var download_ext = ".inc";

// Output Buffer
var output_buffer = "";

// Global Arrays
var tileData = [];
var mapData = [];
var warnings = [];

// Global Objects
var file_reader = new FileReader();

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Setup                                                                      //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

$(document).ready(function() {

	// Define Canvas Contexts
	var hidden_canvas_context = $("canvas#hidden-canvas")[0].getContext("2d");
	var canvas_context = $("canvas#canvas")[0].getContext("2d");

	// Attach input event handlers
	fileInputHandler();
	textPageHandler();
	optionsCheckboxesHandler();
	optionsTextInputsHandler();
	optionsRadioButtonsHandler();
	advancedOptionsControl();

	// Load default options values into input elements
	loadOptionsValues();

	// Load first image into visible canvas
	var first_image = new Image();
	first_image.src = "img/select.png";
	first_image.onload = function() {
		canvas_context.drawImage(first_image, 0, 0);
	}

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// File Input Handler (Process Image on Change)                               //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

	$("input#file-input").change(function() {
		var fileList = this.files;

		// Error check: File input changed but no image selected
		if(fileList.length < 1) {
			return;
		}

		// Error check: Max filesize
		if(fileList[0].size > max_filesize) {
			alert("Filesize is too large.\nMaximum allowed filesize is " +
				(max_filesize / 1024) + "KB.");
			return;
		}
	
		// Load Image
		file_reader.readAsDataURL(fileList[0]);
		file_reader.onload = function (e) {

			var hidden_img = new Image();
			hidden_img.src = e.target.result;

		  hidden_img.onload = function() {

				// Error check: Pixel dimensions
		  	if(hidden_img.width > max_width || hidden_img.height > max_height) {
					alert("Image dimensions are too large.\nMaximum width is " + 
						max_width + "px and maximum height is " + max_height + "px.");
					return;
				}

				// No input file errors, program can continue

				// Reset Global Arrays
				tileData = [];
				mapData = [];
				warnings = [];

				// Save filename for future use
				file_name = fileList[0].name;
				file_name_clean = cleanString(file_name);

				// Save file size for future use
				file_size = parseInt(fileList[0].size);

				// Trim and set Image Attributes
				$("span#att-name").html(trimString(fileList[0].name, 24));
				$("span#att-filesize").html((fileList[0].size / 1024).toFixed(2) + "KB");
				$("span#att-width").html(hidden_img.width.toString() + "px");
				$("span#att-height").html(hidden_img.height.toString() + "px");

				// Define image dimensions ---------------------------------------------

				// Image Pixel Width
				if(hidden_img.width % tile_pw !== 0) {
					image_pw = hidden_img.width + (tile_pw - (hidden_img.width % tile_pw));
					warnings.push("WARNING:  Width of input image padded " +
						(hidden_img.width % tile_pw) + "px to " + image_pw + "px");
				} else {
					image_pw = hidden_img.width;
				}

				// Image Tile Width
				image_tw = image_pw / tile_pw;

				// Image Pixel Height
				if(hidden_img.height % tile_ph !== 0) {
					image_ph = hidden_img.height + (tile_ph - (hidden_img.height % tile_ph));
					warnings.push("WARNING: Height of input image padded " +
						(hidden_img.height % tile_ph) + "px to " + image_ph + "px");
				} else {
					image_ph = hidden_img.height;
				}

				// Image Tile Height
				image_th = image_ph / tile_ph;
				// Image Total Pixel Count
				image_pc = image_pw * image_ph;
				// Image Total Tile Count 
				image_tc = image_tw * image_th;

				// Place image on hidden canvas ----------------------------------------

				// Set Hidden Canvas Width and Height
				$("canvas#hidden-canvas")[0].width = image_pw;
				$("canvas#hidden-canvas")[0].height = image_ph;

				// Fill Hidden Canvas Background with White
				hidden_canvas_context.fillStyle = "#FFFFFF";
				hidden_canvas_context.fillRect(0, 0, image_pw, image_ph);

				// Draw Image on Hidden Canvas
		    hidden_canvas_context.drawImage(hidden_img, 0, 0);

		    // Get Image Pixel Data ------------------------------------------------
		    
				var imageData = hidden_canvas_context.getImageData(0, 0, image_pw, image_ph);

				var pixelData = [];

				// Convert tile data to grayscale
				for(var y = 0; y < image_ph; y++) {
				  for(var x = 0; x < image_pw; x++) {
				  	var index = ((y * image_pw) * 4) + (x * 4);

				  	// Read RGB Data
				  	var r = imageData.data[index];
				  	var g = imageData.data[index + 1];
				  	var b = imageData.data[index + 2];
				    
				    var val = ((r * 0.3) + (g * 0.59) + (b * 0.11));
				    var new_val;

				    // Convert grayscale value to 4 color value
						if(val >= 0 && val < 85) {
							if(val < 65) {
								new_val = 0;
								pixelData.push(0);
							}	else {
								new_val = 85;
								pixelData.push(1);
							}
						} else if (val >= 85 && val < 170) {
							if(val < 129) {
								new_val = 85;
								pixelData.push(1);
							} else {
								new_val = 170;
								pixelData.push(2);
							}
						} else if(val >= 170 && val <= 255) {
							if(val < 193) {
								new_val =  170;
								pixelData.push(2);
							} else {
								new_val = 255;
								pixelData.push(3);
							}
						}

				    // Save Greyscale RGB Data
				    imageData.data[index] = new_val;
				    imageData.data[index + 1] = new_val;
				    imageData.data[index + 2] = new_val;
				  }
				}

				// Apply Greyscale Image to Hidden Canvas
				hidden_canvas_context.putImageData(imageData, 0, 0);

				// Generate Tile Data --------------------------------------------------
				
				for(var y_tile = 0; y_tile < image_th; y_tile++) {
				  for(var x_tile = 0; x_tile < image_tw; x_tile++) {

				  	var tile_index = ((y_tile * image_tw) + x_tile);
				  	tileData[tile_index] = [];

				  	for(var y_pixel = 0; y_pixel < tile_ph; y_pixel++) {

				  		var byte_0 = 0x00;
				  		var byte_1 = 0x00;

				  		var bitmask = 0x80;

				  		for(var x_pixel = 0; x_pixel < tile_pw; x_pixel++) {
				  			var index = (((y_tile * tile_ph) + y_pixel) * image_pw) + ((x_tile * tile_pw) + x_pixel);
				  			var pixel = pixelData[index];

				  			if(pixel === 0) {
				  				// Black
				  				byte_0 = byte_0 | bitmask;
				  				byte_1 = byte_1 | bitmask;
				  			} else if(pixel === 1) {
				  				// Dark Grey
				  				byte_1 = byte_1 | bitmask;
				  			} else if(pixel === 2) {
				  				// Light Grey
				  				byte_0 = byte_0 | bitmask;
				  			} else {
				  				// White
				  			}
				  			bitmask = bitmask >> 1;
				  		}
				  		tileData[tile_index].push(byte_0, byte_1);
				  	}
				  	mapData.push(tile_index);
				  }
				}

				// Generate and Display Output -----------------------------------------
				
				generateOutput();

				// Apply Image to Visible Canvas ---------------------------------------
				
		    var image = new Image();
		    image.src = $("canvas#hidden-canvas")[0].toDataURL();

		    var new_width;
				var new_height;

		    image.onload = function() {

			  	// Determine Image Dimensions for Visible Canvas
					if((image.width > canvas.width && image.height < canvas.height) ||
					   (image.width > canvas.width && image.height > canvas.height && image.width > image.height)) {

						new_width  = canvas.width;
						new_height = Math.ceil((canvas.width * image.height) / image.width);

					} else if((image.width < canvas.width && image.height > canvas.height) || 
						(image.width > canvas.width && image.height > canvas.height && image.width < image.height)) {

						new_width 	= Math.ceil((canvas.height * image.width) / image.height);
						new_height  = canvas.height;

					} else if(image.width > canvas.width && image.height > canvas.width && image.width === image.height) {

						new_width = canvas.width;
						new_height = canvas.height;

					} else if (image.width <= canvas.width && image.height <= canvas.height) {

						new_width  = image.width;
						new_height = image.height;
					}

					// Determine Image Coordinates for Visible Canvas
					var x = Math.floor((canvas.width - new_width) / 2);
					var y = Math.floor((canvas.height - new_height) / 2);

					// Clear Visible Canvas
		  		canvas_context.save();
					canvas_context.globalCompositeOperation = "destination-out";
					canvas_context.clearRect(0, 0, canvas.width, canvas.height);
					canvas_context.restore();

					// Draw Image on Visisble Canvas
					canvas_context.drawImage(image, 0, 0, image.width, image.height, x, y, new_width, new_height);
				}
		  }
		}
	});
});

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Event Handlers                                                             //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

/** ----------------------------------------------------------------------------
 * @function fileInputHandler() Attaches file input trigger event to preview
 *           image figure.
 * -------------------------------------------------------------------------- */
 
function fileInputHandler() {
	$("figure").click(function(e){
		$("input#file-input").trigger("click");
	});
}

/** ----------------------------------------------------------------------------
 * @function textPageHandler() Attaches event to text page controls
 * -------------------------------------------------------------------------- */

function textPageHandler() {
	var text_page = false;
	var animating = false;

	$("a.text-page").click(function(e) {
		e.preventDefault();

		if(!animating) {
			e.stopPropagation();
			animating = true;

			if(!text_page) {
				$("div#text-page").css("display", "block");

				$("div#text-page").fadeTo(text_page_duration, 1, function(){
					text_page = true;
					animating = false;
				});

				$("div#main").click(function(e) {
					e.stopPropagation();
				});

				$("html").click(function() {
					$("a.text-page").trigger("click");
				});

			} else {

				$("div#text-page").fadeTo(text_page_duration, 0, function(){
					$("div#text-page").css("display", "none");
					text_page = false;
					animating = false;
				});

				$("div#main").unbind("click");

				$("html").unbind("click");
			}
		}
	});
}

/** ----------------------------------------------------------------------------
 * @function advancedOptionsControl() Attaches event to and controls animation
 *           of advanced options panel.
 * -------------------------------------------------------------------------- */
function advancedOptionsControl() {

	var advanced_options = false;
	var animating = false;

	$("a#advanced-control").click(function(e) {
		e.preventDefault();

		if(!animating) {
			e.stopPropagation();

			animating = true;

			if(advanced_options) {
				$("div#advanced-options").animate({left:$("form#input").css("width")}, advanced_options_duration, function() {
					animating = false;
					advanced_options = false;
				});

				$(this).html(advanced_options_text_show);

				$("div#app-container").unbind("click");
				$("html").unbind("click");
			} else {
				animating = true;

				$("div#advanced-options").animate({left:0}, advanced_options_duration, function() {
	      	animating = false;
	      	advanced_options = true;
	      });

	      $(this).html(advanced_options_text_hide);

				$("div#app-container").click(function(e) {
					e.stopPropagation();
				});

				$("html").click(function() {
					$("a#advanced-control").trigger("click");
				});
			}
		}
	});
}

/** ----------------------------------------------------------------------------
 * @function optionsCheckboxesHandler() Attaches event handlers to checkboxes
 * -------------------------------------------------------------------------- */

function optionsCheckboxesHandler() {

	var checkboxes = $("input#tile-data")
		.add($("input#tile-map"))
		.add($("input#tile-quantize"))
		.add($("input#pad-map"))
		.add($("input#c-style"));

	$.each(checkboxes, function(){
		$(this).click(function(){
			generateOutput();
		})
	});
}

/** ----------------------------------------------------------------------------
 * function optionsRadioButtonsHandler() Attaches event handlers to radio buttons
 * -------------------------------------------------------------------------- */

function optionsRadioButtonsHandler() {

	var radio_buttons = $("input#asm-format")
		.add($("input#c-format"));

	$.each(radio_buttons, function() {
		$(this).click(function() {

			o_asm_format = $("input#asm-format").attr("checked");
			o_c_format = $("input#c-format").attr("checked");

			if(o_asm_format === "checked") {	

				o_comment = "; ";
				o_line_begin = "DB ";
				o_line_end = "";
				o_hex_prefix = "$";
				o_var_equals = "EQU";
				o_var_char = "";
				o_var_int = "";
				o_array_begin = "";
				o_array_end = "";
				o_array_line_end = "";

			} else if (o_c_format === "checked") {

				o_comment = "// ";
				o_line_begin = "  ";
				o_line_end = ";";
				o_hex_prefix = "0x";
				o_var_equals = "=";
				o_var_char = "const unsigned char ";
				o_var_int = "const int ";
				o_array_begin = "{\r\n";
				o_array_end = "};\r\n";
				o_array_line_end = ",";

			}

			$("input#hex-prefix").val(o_hex_prefix);

			generateOutput();
		})
	})
}

/** ----------------------------------------------------------------------------
 * @function optionsTextInputsHandler() Attaches event handlers to text inputs
 * -------------------------------------------------------------------------- */

function optionsTextInputsHandler() {
	var textInputs = $("input#line-label")
		.add($("input#constant-label"))
		.add($("input#hex-prefix"))
		.add($("input#pad-map-width"))
		.add($("input#pad-map-height"))
		.add($("input#pad-map-value"));

	var decimalInputs	= $("input#pad-map-width")
		.add($("input#pad-map-height"));

	var hexInputs = $("input#pad-map-value");

	// Text Inputs
	$.each(textInputs, function(){

		// When focused, save current value
		$(this).focus(function(){
			$(this).attr("temp", $(this).val());
		});

		// When blurred, compare to saved value
		// If values are different, generate output
		$(this).blur(function(){
			if($(this).attr("temp") !== $(this).val()){
				if($(this).val() === "") {
					$(this).val($(this).attr("temp"));
				} else {
					generateOutput();
				}
			}

			$(this).removeAttr("temp");
		});

		// If enter was pressed, generate output and save new value
		$(this).bind("keydown", function(e){
			if(e.which == 13) {
				$(this).attr("temp", $(this).val());
				generateOutput();
			}
		})
	});

	// Decimal Inputs
	$.each(decimalInputs, function(){
		$(this).bind("keydown", function(e){
			if (e.keyCode !==  8 && // Backspace
			    e.keyCode !==  9 && // Tab
			    e.keyCode !== 37 && // Arrowkey Left
			    e.keyCode !== 38 && // Arrowkey Up
			    e.keyCode !== 39 && // Arrowkey Right
			    e.keyCode !== 40 && // Arrowkey down
			    e.keyCode !== 46 && // Delete
			   (e.keyCode < 37 || e.keyCode > 57)){ // 0-9

        return false;
      }
		});
	});

	// Hex Inputs
	$.each(hexInputs, function(){
		// Use CSS to force only uppercase input
		$(this).css("text-transform", "uppercase");

		$(this).bind("keydown", function(e){
			if (e.keyCode !==  8 && // Backspace
			    e.keyCode !==  9 && // Tab
			    e.keyCode !== 37 && // Arrowkey Left
			    e.keyCode !== 38 && // Arrowkey Up
			    e.keyCode !== 39 && // Arrowkey Right
			    e.keyCode !== 40 && // Arrowkey down
			    e.keyCode !== 46 && // Delete
			   (e.keyCode < 37 || e.keyCode > 70)){ // 0-9, a-f

        return false;
      }
		});
	});
}

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Data Generation                                                            //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

/** ----------------------------------------------------------------------------
 * @function quantizeTileData() Quantizes global tile data array
 * 
 * @return {array} q_tileData Quantized tile data
 * -------------------------------------------------------------------------- */

function quantizeTileData() {

	// Copy Array (Maintain tileData)
	var d_tileData = tileData.slice(0); // Dirty tileData
	var q_tileData = []; // Quantized tileData

	// Delete Duplicate Tile Entries
	for(var i = 0; i < (image_tc - 1); i++) {
		if(d_tileData[i] === undefined) {
			continue;
		}

		var current_tileData = tileData[i].join();

		for(var j = (i + 1); j < image_tc; j++) {
			if(d_tileData[j] === undefined) {
				continue;
			}

			if(current_tileData === tileData[j].join()) {
				delete d_tileData[j];
			}
		}
	}

	// Reset Array Indexes
	for(i = 0; i < image_tc; i++) {
		if (d_tileData[i] !== undefined) {
			q_tileData.push(d_tileData[i]);
		}
	}

	// Return Quantized Tile Data
	return q_tileData;
}

/* -----------------------------------------------------------------------------
 * @function generateMapData(_tileData) Generate map data by comparing _tileData
 *           to global (raw) tileData
 *           
 * @param	{array} _tileData Input tile data
 * 
 * @return {array} mapData Generated map data
 * -------------------------------------------------------------------------- */

function generateMapData(_tileData) {

	var raw_tileData_length = tileData.length;
	var tileData_length = _tileData.length

	var mapData = [];

	for(var i = 0; i < raw_tileData_length; i++) {
		for(var j = 0; j < tileData_length; j++) {
			if(tileData[i].join() === _tileData[j].join()) {
				mapData.push(j);
			}
		}
	}

	if(o_pad_map === "checked") {

		var diff_width = o_pad_map_w  - image_tw;
		var diff_height = o_pad_map_h - image_th;

		var index = 0;

		while(index < (o_pad_map_w * o_pad_map_h)) {
			if(index < (o_pad_map_w * image_th)) {
				index += image_tw;

				for(i = 0; i < diff_width; i++) {
					mapData.splice(index, 0, o_pad_map_v);
					index++;
				}
			} else {
				for(i = 0; i < (diff_height * o_pad_map_w); i++) {
					mapData.splice(index, 0, o_pad_map_v);
					index++;
				}
			}
		}
	}
	return mapData;
}

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Output Generation                                                          //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

/** ----------------------------------------------------------------------------
 * @function generateOutput() Generate data output
 * -------------------------------------------------------------------------- */

function generateOutput() {

	if(tileData.length !== 0) {

		var actual_tileData;
		var actual_tileData_length;

		var actual_mapData;
		var actual_mapData_length;

		// Get Options Values
    getOptionsValues();

		// Clear Output Buffer
		output_buffer = "";

		output_buffer += 
			o_comment + "///////////////////////\r\n" +
			o_comment + "//                   //\r\n" +
			o_comment + "//  File Attributes  //\r\n" +
			o_comment + "//                   //\r\n" +
			o_comment + "///////////////////////\r\n\r\n" +
			o_comment + "Filename: " + file_name + "\r\n" +
			o_comment + "Pixel Width: " + image_pw + "px\r\n" +
			o_comment + "Pixel Height: " + image_ph + "px\r\n\r\n";

		// Include Warnings
		if(warnings.length > 0) {
			for(i = 0; i < warnings.length; i++) {
				output_buffer += o_comment + warnings[i] + "\r\n";
			}
			output_buffer += "\r\n";
		}

		// Determine what data to show
		if(o_tile_quan === "checked") {
			actual_tileData = quantizeTileData();
			actual_tileData_length = actual_tileData.length;
			actual_mapData = generateMapData(actual_tileData);
			actual_mapData_length = actual_mapData.length;
		} else {
			actual_tileData = tileData;
			actual_tileData_length = tileData.length;
			actual_mapData = mapData;
			actual_mapData_length = mapData.length;
		}

		if(o_tile_map === "checked" || o_tile_data === "checked") {
			output_buffer += 
				o_comment + "/////////////////\r\n" +
				o_comment + "//             //\r\n" +
				o_comment + "//  Constants  //\r\n" +
				o_comment + "//             //\r\n" +
				o_comment + "/////////////////\r\n\r\n";
		}

		// Generate Map Data Constants Output
		if(o_tile_map === "checked") {
			if(actual_tileData_length < max_map_length) {

				var actual_tile_width;
				var actual_tile_height;

				if(o_pad_map === "checked") {
					actual_tile_width  = generateHex(o_pad_map_w, o_hex_prefix);
					actual_tile_height = generateHex(o_pad_map_h, o_hex_prefix);
				} else {
					actual_tile_width  = generateHex(image_tw, o_hex_prefix);
					actual_tile_height = generateHex(image_th, o_hex_prefix);
				}

				output_buffer += 
					o_var_int + file_name_clean + "_tile_map_size " + o_var_equals + " " +
					generateHex(actual_mapData_length, o_hex_prefix) + 
					o_line_end + "\r\n" +
					o_var_int + file_name_clean + "_tile_map_width " + o_var_equals + " " +
					actual_tile_width + o_line_end + "\r\n" +
					o_var_int + file_name_clean + "_tile_map_height " + o_var_equals + " " +
					actual_tile_height + o_line_end + "\r\n\r\n";
			}
		}

		// Generate Tile Data Constants Output
		if(o_tile_data === "checked") {
			output_buffer += 
				o_var_int + file_name_clean + "_tile_data_size " + o_var_equals + " " +
				generateHex(actual_tileData_length * 16, o_hex_prefix)  +
				o_line_end + "\r\n" +
				o_var_int + file_name_clean + "_tile_count " + o_var_equals + " " +
				generateHex(actual_tileData.length, o_hex_prefix) +
				o_line_end + "\r\n\r\n";
		}

		// Generate Map Data Output
		if(o_tile_map === "checked") {

			output_buffer +=
				o_comment + "////////////////\r\n" +
				o_comment + "//            //\r\n" +
				o_comment + "//  Map Data  //\r\n" +
				o_comment + "//            //\r\n" +
				o_comment + "////////////////\r\n\r\n";

			if(actual_tileData_length < max_map_length) {

				if(o_asm_format == "checked") {
					output_buffer += file_name_clean + "_map_data:\r\n";
				} else if (o_c_format == "checked") {
					output_buffer += o_var_char + file_name_clean + "_map_data[] " + o_var_equals + o_array_begin;
				}

				output_buffer += o_line_begin;

				for(var i = 0; i < actual_mapData_length; i++) {
					output_buffer += generateHex(actual_mapData[i], o_hex_prefix);

					if(i !== (actual_mapData_length - 1)) {
						if((i + 1) % 16 !== 0) {
							output_buffer += ",";
						} else {
							output_buffer += o_array_line_end + "\r\n";
							if(i !== (actual_mapData_length - 1)) {
								output_buffer += o_line_begin;
							}
						}
					} else {
						output_buffer += "\r\n";
					}
				}
				output_buffer += o_array_end;

			// Too many unique tiles for one tilemap
			} else {
				output_buffer += o_comment + "ERROR: Too many unique tiles for one tilemap. \r\n";
			}
			output_buffer += "\r\n";
		}

		// Generate Tile Data Output
		if(o_tile_data === "checked") {

			output_buffer +=
				o_comment + "/////////////////\r\n" +
				o_comment + "//             //\r\n" +
				o_comment + "//  Tile Data  //\r\n" +
				o_comment + "//             //\r\n" +
				o_comment + "/////////////////\r\n\r\n";

			if(o_asm_format) {
				output_buffer += file_name_clean + "_tile_data:\r\n";
			} else if (o_c_format) {
				output_buffer += o_var_char + file_name_clean + "_tile_data[] " + o_var_equals + o_array_begin;
			}

			for(var i = 0; i < actual_tileData_length; i++) {

				output_buffer += o_line_begin;

				for(var j = 0; j < 16; j++) {
					output_buffer += generateHex(actual_tileData[i][j], o_hex_prefix);

					if ((j + 1) % 16 !== 0) {
						output_buffer += ",";
					} else if (i + 1 < actual_tileData_length) {
						output_buffer += o_array_line_end;
					}
				}

				if(i !== (image_tc - 1)) {
					output_buffer += "\r\n";
				}
			}
			output_buffer += o_array_end;
		}

		// Set Download Link
		var file_name_temp = file_name.split(".");
		file_name_temp.pop();
		file_name_temp = file_name_temp.join().toString();

		var download_name = file_name_temp;

		if (o_c_format === "checked") {
			download_name += ".h";
		} else {
			download_name += download_ext;
		}
		$("a#download").attr("download", download_name);
		$("a#download").attr("href", "data:Application/octet-stream," +
			encodeURIComponent(output_buffer));

		// Display Output
		$('textarea#textarea').val(output_buffer);
	}
}

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// Support Functions                                                          //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

/** ----------------------------------------------------------------------------
 * @function getOptionsValues() Gets options value
 * -------------------------------------------------------------------------- */
function getOptionsValues() {
	// Checkboxes
	o_tile_data = $("input#tile-data").attr("checked");
	o_tile_map = $("input#tile-map").attr("checked");
	o_tile_quan = $("input#tile-quantize").attr("checked");
	o_pad_map = $("input#pad-map").attr("checked");

	// Text Inputs
	// o_line_begin = $("input#line-label").val().toString();
	// o_const_label = $("input#constant-label").val().toString();
	o_hex_prefix = $("input#hex-prefix").val().toString();
	o_pad_map_w = parseInt($("input#pad-map-width").val());
	o_pad_map_h = parseInt($("input#pad-map-height").val());
	o_pad_map_v = $("input#pad-map-value").val().toString();
}

/** ----------------------------------------------------------------------------
 * @function loadOptionsValues() Loads default options values
 * -------------------------------------------------------------------------- */

function loadOptionsValues() {
	// Checkboxes
	o_tile_data === "checked" ?
		$("input#tile-data").attr("checked", o_tile_data) : 
		$("input#tile-data").removeAttr("checked");

	o_tile_map === "checked" ?
		$("input#tile-map").attr("checked", "checked") : 
		$("input#tile-map").removeAttr("checked");

	o_tile_quan === "checked" ?
		$("input#tile-quantize").attr("checked", "checked") : 
		$("input#tile-quantize").removeAttr("checked");

	o_pad_map === "checked" ?
		$("input#pad-map").attr("checked", "checked") : 
		$("input#pad-map").removeAttr("checked");

	o_asm_format === "checked" ?
		$("input#asm-format").attr("checked", "checked") : 
		$("input#asm-format").removeAttr("checked");

	o_c_format === "checked" ?
		$("input#c-format").attr("checked", "checked") : 
		$("input#c-format").removeAttr("checked");

	// Text Inputs
	// $("input#line-label").val(o_line_begin);
	// $("input#constant-label").val(o_var_equals);
	$("input#hex-prefix").val(o_hex_prefix);
	$("input#pad-map-width").val(o_pad_map_w);
	$("input#pad-map-height").val(o_pad_map_h);
	$("input#pad-map-value").val(o_pad_map_v);
}

/* -----------------------------------------------------------------------------
 * @function generateHex(_val, _prefix) Generate a valid hex value from input integer
 * @param	{int} _val Integer to be converted to hex
 * @param	{string} _val Prefix to use for hex values
 * @return {string} val Valid hex value
 * -------------------------------------------------------------------------- */

function generateHex(_v, _prefix) {
	var v = _v;
	var l = v.toString.length + (v.toString.length % 2);
	v = v.toString(16);
	v = v.toUpperCase();
	if(v.length == 1 || v.length == 3) {
		v = "0" + v;
	}
	v = _prefix + v;
	return v;
}

/** ----------------------------------------------------------------------------
 * @function trimString(_str, _l) Trim a string to the specified length and 
 *           represent removed characters with elipsis.
 * @param	{string} _str String to trim
 * @param {int}	_l Max length for input string before being trimmed
 * @return {string} str Trimmed string
 * -------------------------------------------------------------------------- */

function trimString(_str, _l) {
	var str = _str;
	var sl;
	if(str.length > _l) {
  	var sl = Math.floor((_l / 2) - 2);
  	str = str.substr(0, sl) + "..." + str.substr(-sl, sl);
  }
  return str;
}

/** ----------------------------------------------------------------------------
 * @function cleanString(_raw_name) Sanitise name into C variable name
 * @param	{string} _raw Raw name we need to format
 * @return {string} str Variable name copmlying with C variable constraints
 * -------------------------------------------------------------------------- */

function cleanString(_raw) {
	var raw = _raw;
	var safe_chars = /[a-z_0-9]/i;
	var clean_string = "";
	for (var i = 0, len = raw.length; i < len; i++) {
		if (raw[i] === ".") {
			break;
		}
		if (safe_chars.test(raw[i])) {
			clean_string += raw[i];
		}
	}
	return clean_string;
}
