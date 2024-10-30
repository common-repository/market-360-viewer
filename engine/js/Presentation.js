presentationLib.Presentation = function(main) {
    var that = this;

    var isTouch = Modernizr.touch;
    var CLICK_EV = isTouch ? "touchend" : "click";
    var START_EV = isTouch ? "touchstart" : "mousedown";
    var END_EV = isTouch ? "touchend" : "mouseup";
    var MOVE_EV = isTouch ? "touchmove" : "mousemove";
    var MWHEEL_EV = "mousewheel DOMMouseScroll";

    var ROTATE_LEFT = 1;
    var ROTATE_RIGHT = 0;
    var FULLSCREEN_ENABLED = 1;
    var ZOOM_ENABLED = 1;
	var NORMAL_MODE = 0;
	var PING_PONG_MODE = 1;
	
    var ROTATION_SLOW_DOWN_LEVELS = 2;
    var MAX_STEPS_ON_DRAG_STOP = 400;
    var SLOW_DOWN_BY_TIMES = 2;

    var isLoaded = false;
	var isAndroid = navigator.userAgent.toLowerCase( ).indexOf( "android" ) > -1;
    var isIPad = navigator.userAgent.match(/iPad/i) != null;
    var fullScreenFunction = document.documentElement.requestFullScreen || document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullScreen || document.documentElement.mozRequestFullScreen || document.documentElement.msRequestFullscreen;

    var $presentationInjectContainer, $mainPresentationContainer, $outerWrapper, $controlsPanel, $rotateButton, $zoomInButton, $zoomOutButton, $leftButton, $rightButton, $fullscreenButton, $rotationLayer;

    var zoomLayers = [];
    this.$activeLayer;

    this.currentImageIndex;
    this.config;
    this.userConfig;
    this.zoomLevelIndex = 0;
    var previousZoomIndex = 0;

    var deltaX = 0; // to count speed after mouseup dufing rotation
	var globalRotateDirection;

    var firstRotationStop = true;

    var xPrevious, yPrevious;
    var manualRotationInProgress;
    var autoRotationInProgress;
    var rotationInterval, initialInterval, endInterval;

    // config parameters
    var startImageNumber, rotationDelayTimeout, manualRotationSlowParam, autoRotationFps, slowRotationFps, fastRotationFps, initialRotationFps, autoRotationDirection, autoRotationDelay, autoRotationMode, framesCount, maxZoomLevel, fullscreenEnabled, zoomEnabled, zoomArray = [], zoomNames = [],
        tilesDimensions, tileMargin, keyFrames;

    var presentationImagesUrls = [];
    var lastAvailableZoomLevelIndex;

    var resMan = main.ResManager;

    var mouseStartHandled = false,
        x, y;
    var moving = false;
    var mouseStartXOffset, mouseStartYOffset;

    var presentationWindowLeftPosition, presentationWindowRightPosition, presentationWindowTopPosition, presentationWindowBottomPosition;

    var subImages;

    var minZoomLevelIndex = 0;

    var imagesToLoad = [];
    var visibleImagesNumbers = [];

    var normalHeight, normalWidth;
    var manualRotationStep, manualRotationInterval = 1,
        stepsToAutorotate = 1;

    var fullscreenActive = false;
	var keyFramesModeActive = false;

    var pinchZoomingTouchEnd = false;

    var previousLayerLeft, previousLayerTop, currentZoomIndex, previousLayerLeftMargin, previousLayerTopMargin, previousLayerWidth, previousLayerHeight;

    var $loadingDiv;

    var newHeight = 0,
        newWidth = 0,
        newLeft = 0,
        newTop = 0,
        newMarginLeft = 0,
        newMarginTop = 0;

    var transitionEndCounter = 0;
    var transitionStartCounter = 0;

    var blockZoomDuringMove = false,
        blockPresentationMove = false,
		blockAllUserInteractions = false;

    var transEndEventNames = {
        'WebkitTransition': 'webkitTransitionEnd',
        'MozTransition': 'transitionend',
        'OTransition': 'oTransitionEnd otransitionend',
        'msTransition': 'MSTransitionEnd',
        'transition': 'transitionEnd'
    };
    var transitionEndEvent = transEndEventNames[Modernizr
        .prefixed('transition')];

	var zoomingBeforeRotation = false;

    var iePinchGestureInProgress;

    var rotationLayerImages;

    var startInterval, showFirstFrameInterval;

    var keyFramesLoaded = false;

    this.initPresentation = function(callback) {

        that.zoomLevelIndex = 1;
        that.config = new presentationLib.Config();
        that.userConfig = new presentationLib.UserConfig();

        findControls();
        initializeVariables();
		$loadingDiv.show();
        resizedWidth = tilesDimensions[0].width;
        resizedHeight = tilesDimensions[0].height;
        prepareFramesSrc();
        buildZoomLayers();
		
		//if there are key frames show proper control buttons
		if( keyFrames.length > 0 ){
			$rotateButton.removeClass("pause");
			$rotateButton.addClass("keyFrames");
		}
		
        that.$activeLayer = $mainPresentationContainer.find(".zoomLayer.zoomLayerId-" + that.zoomLevelIndex + "_" + zoomArray[that.zoomLevelIndex]);
        showFirstFrameInterval = setInterval(function() {
            // wait untill outerWrapper gets proper dimensions
            if ($outerWrapper.width() !== main.width || $outerWrapper.height() !== main.height ) {
                return;
            }
			
            clearInterval(showFirstFrameInterval);
            scalePresentationToMinZoomLevel();
            initRotationLayer(function() {
                newHeight = $rotationLayer.height();
                newWidth = $rotationLayer.width();
                bindEvents();
                showRotationLayer(true);
                setPresentationMargins();
 				initKeyFrames(function(){
 					keyFramesLoaded = true;
 					refreshControlButtons();
 				});
            }, function(){
            	$presentationInjectContainer.find("#loadingMask").fadeOut(1000);
            });
        }, 500);
		
		startInterval = setInterval(function() {
			if ( main.fullPercentage && main.allFilesLoaded) {
				clearInterval(startInterval);
				//start obrotu po zaladowaniu prezentacji
				that.blockAllUserInteractions();
				that.startAfterLoadFinish(callback);
			}
		}, 500);
    };

	this.startKeyFrameAnimation = function( direction, nextKeyFrameIndex) {
		clearTimeout(rotationDelayTimeout);
        clearInterval(rotationInterval);
        rotationInterval = undefined;

		if( firstKeyFrameAnimationDuringEntering === false ){
			setProperCurrentImageIndexBeforeRotation( direction );
		}
		
		globalRotateDirection = direction;
		setStartSlowDownRotateInterval( false, function( nextKeyFrameIndex ) {
			return function(){
				that.setFrameImageSrc( nextKeyFrameIndex );
				previousKeyFrameIndex = nextKeyFrameIndex;
			};
		} ( nextKeyFrameIndex ) );
	};

    this.startAfterLoadFinish = function(callback) {
		$loadingDiv.hide();
		setTimeout(function() {
			that.startAutoRotateWithDelay( true );
			normalHeight = $presentationInjectContainer.height();
			normalWidth = $presentationInjectContainer.width();
			manualRotationStep = parseInt((normalWidth / framesCount) * manualRotationInterval);
			isLoaded = true;

			if (callback) {
				callback();
			}

		}, 500);
		$controlsPanel.css('visibility', 'visible');
    };
	
	this.blockAllUserInteractions = function(){
		//block all user interactions during key frame animations
		$controlsPanel.find(".controlButton").addClass("buttonDisabled");
		blockAllUserInteractions = true;
	};
	
	this.unblockAllUserInteractions = function(){
		//unblock all user interactions key frame animations end
		refreshControlButtons();
		blockAllUserInteractions = false;
	};

    function prepareFramesSrc() {
        var imgNo;
        if (main.configPath !== "") {
            for (var i = 0; i < framesCount; i++) {
                imgNo = (i + 1) < 10 ? "00" + (i + 1) : "0" + (i + 1);
                //presentationImagesUrls[i] = main.configPath + "tiles/" + 'tile_' + imgNo + '_001_001_001.jpg';
                presentationImagesUrls[i] = main.configPath + "tiles/" + 'tile_' + imgNo + '_0600_001_001.jpg';
            }
        }
    };


    var buildZoomLayers = function() {
        var zoomLayer;
        for (var i = 1; i < zoomArray.length; i++) {
            zoomLayer = document.createElement("div");
            zoomLayer.className = "zoomLayer" + " zoomLayerId-" + i + "_" + zoomArray[i];
            jQuery(zoomLayer).css("z-index",
                2 * (lastAvailableZoomLevelIndex + 1 - i));
            //zoomLayer.id = "zoomLayer" + i + "_" + zoomArray[i];

            $outerWrapper[0].appendChild(zoomLayer);
            zoomLayers.push(zoomLayer);
        }
        jQuery(".zoomLayer").find("*").remove();
    };

    var imagesCount = 0;

    var initKeyFrames = function(callback){
    	if ( keyFrames.length === 0 ){
    		callback();
    	}else{
    		var keyFramesCount = 0;
    		for (var i = 0; i < presentationImagesUrls.length; i++) {
    			// skip normal frames
    			if (keyFrames.indexOf(i) < 0) {
    				continue;
    			}
    			var imageContainer = document.createElement("img");
            	imageContainer.className = "imageContainer" + " imageContainerId-" + i;
				imageContainer.draggable = false;
    			imageContainer.addEventListener('load', function() {
	                keyFramesCount++;
	                if (keyFrames.length === keyFramesCount && callback) {
	                   		callback();
	                }
            	});

    			imageContainer.src = presentationImagesUrls[i];

				jQuery(imageContainer).addClass("keyFrame");
				jQuery(imageContainer).css("opacity",0);
				var display = i === 1 ? 'visible' : 'hidden';
            	jQuery(imageContainer).css('visibility', display);
            	$rotationLayer[0].appendChild(imageContainer);
    		}
			rotationLayerImages = $rotationLayer.find("img");
    	}
    };

    var initRotationLayer = function(callback, callbackAfterFirst) {
        imagesCount = 0;

        $rotationLayer.find("*").remove();
        for (var i = 0; i < presentationImagesUrls.length; i++) {
        	// do not load keyFrames yet
        	if ( keyFrames.indexOf(i) >= 0 ){
        		continue;
        	}

            var imageContainer = document.createElement("img");
            imageContainer.className = "imageContainer" + " imageContainerId-" + i;
			imageContainer.draggable = false;
            //imageContainer.id = i;
            if ( i === startImageNumber ){
            	imageContainer.addEventListener('load', function() {
            		main.nextLoadStep = true;
            		if (callbackAfterFirst){ 
            			callbackAfterFirst();
            		}
            	});
            }
            imageContainer.addEventListener('load', function() {
                imagesCount++;
                if (presentationImagesUrls.length - keyFrames.length === imagesCount && callback) {
                    callback();
                }
            });
            imageContainer.src = presentationImagesUrls[i];
			

            var display = i === 1 ? 'visible' : 'hidden';
            jQuery(imageContainer).css('visibility', display);
            $rotationLayer[0].appendChild(imageContainer);
        }
        rotationLayerImages = $rotationLayer.find("img");

        that.setFrameImageSrc();
    };

    function buildImagesGrid(callback, zooming) {
        var breakLineAfter = zoomArray[that.zoomLevelIndex];

        var zLevel = zoomArray[that.zoomLevelIndex];
        var zoomWidth = zLevel * tilesDimensions[that.zoomLevelIndex].width;
        var zoomHeight = zLevel * tilesDimensions[that.zoomLevelIndex].height;

        if (zoomWidth % zLevel !== 0) {
            zoomWidth = Math.floor(zoomWidth);
        }

        if (zoomHeight % zLevel !== 0) {
            zoomHeight = Math.floor(zoomHeight);
        }

        that.$activeLayer.width(zoomWidth);
        that.$activeLayer.height(zoomHeight);

        if (!zooming) {
            $rotationLayer.width(zoomWidth);
            $rotationLayer.height(zoomHeight);
            increaseTransitionStartCoutnerBy(2);
        }

        var imageContainer;
        for (var i = 0; i < zLevel * zLevel; i++) {
            imageContainer = document.createElement("div");
            imageContainer.className = "imageContainer";
            jQuery(imageContainer).width(tilesDimensions[that.zoomLevelIndex].width);
            jQuery(imageContainer).height(
                tilesDimensions[that.zoomLevelIndex].height);

            if (zoomArray[that.zoomLevelIndex] > 1) {
                jQuery(imageContainer)
                    .css(
                        "background-size", (tilesDimensions[that.zoomLevelIndex].width + tileMargin * 2) + "px " + (tilesDimensions[that.zoomLevelIndex].height + tileMargin * 2) + "px");
                jQuery(imageContainer).css("background-position", -tileMargin + "px " + -tileMargin + "px");
            } else {
                jQuery(imageContainer).css(
                    "background-size", (tilesDimensions[that.zoomLevelIndex].width) + "px " + (tilesDimensions[that.zoomLevelIndex].height) + "px");
            }

            that.$activeLayer[0].appendChild(imageContainer);

            if (zLevel < zoomArray[minZoomLevelIndex]) {
                breakLineAfter = zoomArray[minZoomLevelIndex];
            }

            if ((i + 1) % breakLineAfter === 0) {
                var br = document.createElement('br');
                that.$activeLayer[0].appendChild(br);
            }
        }

        subImages = that.$activeLayer.find(".imageContainer");

        currentZoomIndex = that.zoomLevelIndex;

        if (callback) {
            callback();
        }
    };

    function centerLayerAfterZoom(newWidthLocal, newHeightLocal, zooming) {
        var rotationLayerWidth, rotationLayerHeight;
        var setLeftMargin = false,
            setTopMargin = false;

        if (newWidthLocal && newHeightLocal) {
            rotationLayerWidth = newWidthLocal;
            rotationLayerHeight = newHeightLocal;
        } else {
            rotationLayerWidth = $rotationLayer.width();
            rotationLayerHeight = $rotationLayer.height();
        }

        if ($outerWrapper.height() > rotationLayerHeight) {
            newTop = 0;
            if (!zooming) {
                $rotationLayer.css("top", "0");
                that.$activeLayer.css("top", "0");
            }
            setTopMargin = true;
        } else {
            resetPresentationMargins(false);
        }

        if ($outerWrapper.width() > rotationLayerWidth) {
            newLeft = 0;
            if (!zooming) {
                $rotationLayer.css("left", "0");
                that.$activeLayer.css("left", "0");
            }
            setLeftMargin = true;
        } else {
            resetPresentationMargins(true, zooming);
        }

        if (setTopMargin || setLeftMargin) {
            setPresentationMargins(zooming);
        }

        if (currentZoomIndex === minZoomLevelIndex) {
            newLeft = 0;
            newTop = 0;
        } else {

            var leftZoomRatio = zoomArray[currentZoomIndex] / (zoomArray[previousZoomIndex] * (previousLayerWidth / (zoomArray[previousZoomIndex] * tilesDimensions[currentZoomIndex].width)));
            var topZoomRatio = zoomArray[currentZoomIndex] / (zoomArray[previousZoomIndex] * (previousLayerHeight / (zoomArray[previousZoomIndex] * tilesDimensions[currentZoomIndex].height)));

            newLeft = -(leftZoomRatio * (Math.abs(previousLayerLeft) - previousLayerLeftMargin + $outerWrapper
                .width() / 2) - $outerWrapper.width() / 2);
            newTop = -(topZoomRatio * (Math.abs(previousLayerTop) - previousLayerTopMargin + $outerWrapper
                .height() / 2) - $outerWrapper.height() / 2);
            // preserving presentation window limits
            newLeft = newLeft >= 0 ? 0 : newLeft;
            newTop = newTop >= 0 ? 0 : newTop;

            newLeft = (newLeft + rotationLayerWidth + newMarginLeft * 2) < $outerWrapper
                .width() ? (newLeft + ($outerWrapper.width() - (newLeft + rotationLayerWidth))) : newLeft;
            newTop = (newTop + rotationLayerHeight + newMarginTop * 2) < $outerWrapper
                .height() ? (newTop + ($outerWrapper.height() - (newTop + rotationLayerHeight))) : newTop;
        }

        if (!setLeftMargin && !zooming) {
            $rotationLayer.css("left", newLeft + "px");
            that.$activeLayer.css("left", newLeft + "px");
        }

        if (!setTopMargin && !zooming) {
            $rotationLayer.css("top", newTop + "px");
            that.$activeLayer.css("top", newTop + "px");
        }

    }
    var positionLeft, positionTop, positionRight, positionBottom;

    function prepareVisibleImagesNumbersArray() {
        if (that.zoomLevelIndex > 0) {
            // **** prepare layers *******
            that.$activeLayer.show();

            //			if (main.debugMode) {
            //				main.Debug.showImagesDebugGrid();
            //			}

            // **************************

            visibleImagesNumbers.length = 0;
            var $imageContainer;

            subImages = that.$activeLayer.find(".imageContainer");
            if (subImages.length === 0) {
                return;
            }
            for (var i = 0; i < subImages.length; i++) {
                $imageContainer = jQuery(subImages[i]);
                if (isWithingPresentationWindowRange($imageContainer) && !hasBackgroundImage($imageContainer)) {
                    // load image
                    visibleImagesNumbers.push(i + 1);
                }
            }

            downloadImages(that.zoomLevelIndex);
        }
    };

    function isWithingPresentationWindowRange($object) {
        positionLeft = $object.offset().left;
        positionRight = positionLeft + $object.width();
        positionTop = $object.offset().top;
        positionBottom = positionTop + $object.height();
        if ((positionRight > presentationWindowLeftPosition) && (positionLeft < presentationWindowRightPosition) && (positionBottom > presentationWindowTopPosition) && (positionTop < presentationWindowBottomPosition)) {
            return true;
        } else {
            return false;
        }

    };

    function isAnyActiveLayerContainerWithoutImage() {
        for (var i = 0; i < subImages.length; i++) {
            if (!hasBackgroundImage(jQuery(subImages[i]))) {
                return true;
            }
        }
        return false;
    };

    function hasBackgroundImage($object) {
        if ($object.css("background-image") !== "" && $object.css("background-image") !== "none") {
            return true;
        } else {
            return false;
        }
    };

    function setImagesSrc() {
        subImages = that.$activeLayer.find(".imageContainer");
        if (subImages.length === 0) {
            return;
        }
        for (var i = 0; i < visibleImagesNumbers.length; i++) {
            subImages[visibleImagesNumbers[i] - 1].style.backgroundImage = "url('" + imagesToLoad[i] + "')";
            subImages[visibleImagesNumbers[i] - 1].style.opacity = 1;
        }

        var zindexToSet = that.$activeLayer.css("z-index") - 1;
        $rotationLayer.css("z-index", zindexToSet);

    };

    var initializeVariables = function() {
        loadParameters();

        that.currentImageIndex = startImageNumber;

        manualRotationInProgress = false;
        autoRotationInProgress = false;
        globalRotateDirection = autoRotationDirection;

        setPresentationWindowPosition();

        if (fullscreenEnabled !== FULLSCREEN_ENABLED) {
            $fullscreenButton.addClass("hidden");
        }

        if (zoomEnabled !== ZOOM_ENABLED) {
            $zoomOutButton.hide();
            $zoomInButton.hide();
        } else {
            $zoomOutButton.addClass("buttonDisabled");
        }

        if (isTouch) {
            $controlsPanel.addClass("touch");
        } else {
            $controlsPanel.addClass("notouch");
        }

    };

    function setPresentationWindowPosition() {
        presentationWindowLeftPosition = $outerWrapper.offset().left;
        presentationWindowTopPosition = $outerWrapper.offset().top;
        presentationWindowRightPosition = presentationWindowLeftPosition + $outerWrapper.width();
        presentationWindowBottomPosition = presentationWindowTopPosition + $outerWrapper.height();
    };

    var findControls = function() {
        $presentationInjectContainer = main.$container;
        main.$container.data("market360-engine", that);
        $mainPresentationContainer = $presentationInjectContainer
            .find(".mainPresentationContaier");
        $outerWrapper = $mainPresentationContainer.find(".outerWrapper");
        $controlsPanel = $mainPresentationContainer.find(".controlsPanel");
        $rotateButton = $controlsPanel.find(".rotateButton");
        $zoomInButton = $controlsPanel.find(".zoomInButton");
        $zoomOutButton = $controlsPanel.find(".zoomOutButton");
        $leftButton = $controlsPanel.find(".leftButton");
        $rightButton = $controlsPanel.find(".rightButton");
        $fullscreenButton = $controlsPanel.find(".fullscreenButton");
        $rotationLayer = $outerWrapper.find(".rotationLayer");
        $loadingDiv = $outerWrapper.find(".loadingDiv");
    };

    var bindEvents = function() {
        //$outerWrapper.off();
        $outerWrapper.on(START_EV, function(event) {
			if( blockAllUserInteractions ){
				return;
			}
			
			event.preventDefault();
			
            if ((!isTouch && event.which !== 1) || blockPresentationMove) {
                // accept only left mouse button
                return;
            }

            if (!isLoaded) // if presentation is not fully loaded yet
                return;

            blockZoomDuringMove = true;

            deltaX = 0;
            distanceMoved = 0;
			distanceMovedFromStartY = 0;
			distanceMovedFromStartX = 0;
            previousDistance = 0;
            pinchZoomLevelIndex = that.zoomLevelIndex;
            currentZoomIndex = that.zoomLevelIndex;
            jQuery(window).on(MOVE_EV, moveEvent);

            if (minZoomLevelIndex === that.zoomLevelIndex) {
                manualRotationInProgress = true;
            }

            autoRotationInProgress = false;
            clearTimeout(rotationDelayTimeout);
            clearInterval(rotationInterval);
            rotationInterval = undefined;
            currentSlowDownTimes = 0;
        });
		
		$outerWrapper.on("dragstart", function() {
			//firefox fix. Rotation layer images were draggable despite of the fact that all images has the draggable attribute set to false
			return false;
		});

        $outerWrapper.on(MWHEEL_EV, function(e) {
			if( blockAllUserInteractions ){
				return;
			}
			
            var e = window.event || e;
            if( !isFullScreenActive() ) {
            	var scrollTo = e.wheelDelta * -1;
            	if( !scrollTo ) {
            		var scrollTop = jQuery('body,html').scrollTop();
            		scrollTo = e.originalEvent.detail * 30;
            		scrollTo = scrollTo + scrollTop;
    				jQuery("body,html").scrollTop(scrollTo);
            	} else {
            		var scrollTop = jQuery('body').scrollTop();
            		var scrollTo2 = (scrollTo / 2) + scrollTop;
    				jQuery("body").scrollTop(scrollTo2);
    				
            		scrollTop = document.documentElement.scrollTop;
            		scrollTo2 = scrollTo + scrollTop;
    				document.documentElement.scrollTop = scrollTo2;
            	}
				return;
            }
            if (e.preventDefault) {
                e.preventDefault();
            } else {
                // for example IE9
                e.returnValue = false;
            }

            var delta = e.originalEvent ? wheelDirection(
                e.originalEvent.detail, true) : wheelDirection(
                e.wheelDelta, false);
            if (delta) {
                if (zoomEnabled !== ZOOM_ENABLED || $zoomInButton.hasClass("buttonDisabled")) {
                    return;
                }

                zoomIn();
            } else {
                if (zoomEnabled !== ZOOM_ENABLED || $zoomOutButton.hasClass("buttonDisabled")) {
                    return;
                }

                zoomOut();
            }
        });

        var wheelDirection = function(delta, isFFEvent) {
            if ((isFFEvent && delta < 0) || (!isFFEvent && delta > 0)) {
                return true;
            } else {
                return false;
            }
        };

        //$(window).off(END_EV);
        jQuery(window).on(
            END_EV,
            function(event) {
			
                blockZoomDuringMove = false;
                if (pinchZooming) {
                    pinchZoomingTouchEnd = true;
                    mouseStartHandled = false;
                    previousZoomIndex = that.zoomLevelIndex;
                    currentZoomIndex = pinchZoomLevelIndex;
                    that.zoomLevelIndex = pinchZoomLevelIndex;
                    if (!cssZoomTransitionInProgress) {
                        // touch end after css transition is over
                        showImagesOnNewLayer(undefined, true);
                    }
                } else {
                    jQuery(window).off(MOVE_EV);

                    xPrevious = 0;
                    yPrevious = 0;
					
					distanceMovedFromStartX = 0;
					distanceMovedFromStartY = 0;

                    mouseStartHandled = false;
                    moving = false;
					
					if( !keyFramesMoveInProgress ){
						if (manualRotationInProgress && !keyFramesModeActive) {
							var dateDiff = Date.now() - lastMoveEventDetectedMilis;
							var minStepToRun = manualRotationStep * manualRotationInterval * stepsToAutorotate;
							if ((Math.abs(deltaX) > minStepToRun) && (dateDiff < 500)) {
								// handle only fast movements
								globalRotateDirection = deltaX > 0 ? ROTATE_RIGHT : ROTATE_LEFT;
								rotate(parseInt(Math.abs(deltaX) / (manualRotationSlowParam)));
							} else if (that.zoomLevelIndex > 0) {
								that.setFrameImageSrc();

								stopAutoRotation();
								if (firstRotationStop) {
									firstRotationStop = false;
									showImagesOnNewLayer();
								} else {
									showRotationLayer(false);
									// showing rotation layer for fixing
									// blinking effect during images changing
									// time
									resetSrcAttributeOfActiveLayer();
									prepareVisibleImagesNumbersArray();
								}
							}
							$rotateButton.removeClass("pause");
//							autoRotationInProgress = false;
							manualRotationInProgress = false;
						} else {
							if (that.zoomLevelIndex > minZoomLevelIndex && !jQuery(event.target).hasClass(
								"controlButton")) {
								prepareVisibleImagesNumbersArray();
							}
						}
					}else{
						keyFramesMoveInProgress = false;
						manualRotationInProgress = false;
					}
                }
            });

        jQuery(window).on('orientationchange', refreshScreenMode);

        // windows 8 IE specific
        if (typeof screen.addEventListener === "function") {
            screen.addEventListener('MSOrientationChange', refreshScreenMode,
                false);
        }

        //$rotateButton.off();
        $rotateButton.on(CLICK_EV, function(e) {
            if ( ( that.zoomLevelIndex > minZoomLevelIndex && keyFrames.length === 0 ) || blockAllUserInteractions) {
                return;
			}
			
			if( keyFrames.length > 0 ){
				//if there are any key frames in the presentation
				if( keyFramesModeActive === false ){
					//enter key frame mode
					keyFramesModeActive = true;
					firstKeyFrameAnimationDuringEntering = true;
					previousKeyFrameIndex = 0;
					$rotateButton.removeClass("keyFrames");
					$rightButton.addClass("keyFrames");
					$leftButton.addClass("keyFrames");
					showRotationLayer(true);
					stopAutoRotation();
					showNextKeyFrame(ROTATE_LEFT);
					
				}else{
					//exit key frame mode
					if (minZoomLevelIndex < currentZoomIndex){
						//if image is zoomed, zoom out and then start rotation
						previousZoomIndex = minZoomLevelIndex + 1;
						that.zoomLevelIndex = minZoomLevelIndex;
						currentZoomIndex = that.zoomLevelIndex;
						doZooming(minZoomLevelIndex);
						zoomingBeforeRotation = true;

						var testingZoom = setInterval( function(){
							if ( !cssZoomTransitionInProgress ){
								clearInterval( testingZoom );
								exitKeyFramesMode();
							}
						}, 15 );
					}else{
						exitKeyFramesMode();
					}
				}
			}else{
				//normal presentation mode
				if (autoRotationInProgress) {
					stopAutoRotation();
					showImagesOnNewLayer();
				} else {
					// ***** fix for rotate button click during slow down effect
					// *******
					clearInterval(rotationInterval);
					rotationInterval = undefined;
					// *****************************************************************

					if( keyFrames.length === 0 ){
						$rotateButton.addClass("pause");
					}
					autoRotationInProgress = true;
					globalRotateDirection = autoRotationDirection;
					setRotateInterval();
					showRotationLayer(true);
				}
			}
        });

        $fullscreenButton.off();
        $fullscreenButton.on(CLICK_EV, function(e) {
			if( blockAllUserInteractions ){
				return;
			}
            e.stopPropagation();
            jQuery("body").data("fullscreen-market360-target", that);
            toggleFullScreen();
        });

        // full screen change detection for various browsers
        // $(document)
        //     .off(
        //         "fullscreenchange mozfullscreenchange webkitfullscreenchange MSFullscreenChange");
        jQuery(document)
            .on(
                "fullscreenchange mozfullscreenchange webkitfullscreenchange MSFullscreenChange", fullscreenChangeHandler );

        jQuery(document).keydown(function(e) {
			//ESC key
			if( blockAllUserInteractions ){
				return;
			}
			
            if (e.which === 27 && fullscreenActive) {
                adjustPresentationToNormalScreen();
            }
        });

        //$zoomInButton.off();
        $zoomInButton.on(CLICK_EV, function() {
            if (zoomEnabled !== ZOOM_ENABLED || $zoomInButton.hasClass("buttonDisabled") || blockAllUserInteractions) {
                return;
            }

            if (autoRotationInProgress) {
                stopAutoRotation();
            }
            zoomIn();

        });

        //$zoomOutButton.off();
        $zoomOutButton.on(CLICK_EV, function() {
            if (zoomEnabled !== ZOOM_ENABLED || $zoomOutButton.hasClass("buttonDisabled") || blockAllUserInteractions) {
                return;
            }

            if (autoRotationInProgress) {
                stopAutoRotation();
            }
            zoomOut();
        });

        //$leftButton.off();
        $leftButton.on(CLICK_EV, function() {
			if( blockAllUserInteractions ){
				return;
			}
			
			if (keyFramesModeActive) {
				//in key frames mode rotation should be reversed in comparison to normal mode
				globalRotateDirection = ROTATE_LEFT;
				showNextKeyFrame(ROTATE_LEFT);
			} else {
				globalRotateDirection = ROTATE_RIGHT;
				if (that.zoomLevelIndex === minZoomLevelIndex) {

					if (autoRotationInProgress) {
						stopAutoRotation();
						showImagesOnNewLayer();
					}

					showRotationLayer(false);
					countNewCurrentImageIndex( 1 );
					skipKeyFrame();
					that.setFrameImageSrc();
					setTimeout(function() {
						$rotationLayer.css("z-index", "auto");
					}, 100);
					resetSrcAttributeOfActiveLayer();
					prepareVisibleImagesNumbersArray();
				} else {
					countNewCurrentImageIndex( 1 );
					skipKeyFrame();
					that.setFrameImageSrc();
					resetSrcAttributeOfActiveLayer();
					prepareVisibleImagesNumbersArray();
				}
			}
        });

			//$rightButton.off();
			$rightButton.on(CLICK_EV, function() {
				if( blockAllUserInteractions ){
					return;
				}
				
				if (keyFramesModeActive) {
					//in key frames mode rotation should be reversed in comparison to normal mode
					globalRotateDirection = ROTATE_RIGHT;
					showNextKeyFrame(ROTATE_RIGHT);
				} else {
					globalRotateDirection = ROTATE_LEFT;
					if (that.zoomLevelIndex === minZoomLevelIndex) {

						if (autoRotationInProgress) {
							stopAutoRotation();
							showImagesOnNewLayer();
						}

						showRotationLayer(false);
						countNewCurrentImageIndex( 1 );
						skipKeyFrame();
						that.setFrameImageSrc();
						setTimeout(function() {
							$rotationLayer.css("z-index", "auto");
						}, 100);
						resetSrcAttributeOfActiveLayer();
						prepareVisibleImagesNumbersArray();
					} else {
						countNewCurrentImageIndex( 1 );
						skipKeyFrame();
						that.setFrameImageSrc();
						resetSrcAttributeOfActiveLayer();
						prepareVisibleImagesNumbersArray();
					}
				}
			});

        // disable double tap zooming when tapping presentation controls
        $controlsPanel.on(START_EV, function(e) {
            e.stopPropagation();;
            e.preventDefault();
        });

        // Windows 8 gestures -> pinch zoom detection
        if (typeof MSGesture === "function") {
            $outerWrapper[0].addEventListener("pointerdown", function(e) {
                fingersAmount++;
                gesture.addPointer(e.pointerId);
            }, false);

            window.addEventListener("pointerup", function(e) {
                fingersAmount--;
                if (fingersAmount < 0) {
                    fingersAmount = 0;
                }
            }, false);

            $outerWrapper[0].addEventListener("MSGestureStart", function(e) {
                if (fingersAmount > 1) {
                    iePinchGestureInProgress = true;
                    pinchZooming = true;
                    pinchZoomingTouchEnd = false;
                }
            }, false);

            $outerWrapper[0].addEventListener("MSGestureEnd", function(e) {
                if (iePinchGestureInProgress) {
                    iePinchGestureInProgress = false;
                }
            }, false);

            $outerWrapper[0].addEventListener("MSGestureChange", function(e) {
                if ((e.scale && e.scale === 1) || ++gestureIndex < 10 || zoomEnabled !== ZOOM_ENABLED || !iePinchGestureInProgress) {
                    return;
                }

                gestureIndex = 0;

                if (e.scale > 1 && pinchZoomLevelIndex < lastAvailableZoomLevelIndex) {
                    // pinch zoom in
                    pinchZoomIn();
                } else if (e.scale < 1 && pinchZoomLevelIndex > minZoomLevelIndex) {
                    // pinch zoom out
                    pinchZoomOut();
                }
            }, false);

            gesture = new MSGesture();
            gesture.target = $outerWrapper[0];
        }
    };
	
	function exitKeyFramesMode(){
		keyFramesModeActive = false;
		$rotateButton.addClass("keyFrames");
		$rightButton.removeClass("keyFrames");
		$leftButton.removeClass("keyFrames");

		//after leaving key frames mode, start auto rotation from the frame before/after key frame
		setProperCurrentImageIndexBeforeRotation();
		that.startAutoRotateWithDelay( false );
	};
	
	function fullscreenChangeHandler() {
		if (jQuery("body").data("fullscreen-market360-target") != that || blockAllUserInteractions ) {
			return;
		}
		that.blockAllUserInteractions();
		that.stopGlobalAutoRotation();
		that.$activeLayer.find("*").remove();
		if (!isFullScreenActive()) {
			setTimeout(function() {
				adjustPresentationToNormalScreen();
			}, 500);
		} else {
			setTimeout(function() {
				adjustPresentationToFullScreen();
			}, 500);

		}
	}
	
    var gesture, gestureIndex = 0,
        fingersAmount = 0;

    var transitionsEnded = [];

    function emulateTransitionEnd() {
        blockPresentationMove = true;
		main.log("blockPresentationMove = "+blockPresentationMove);
        transitionsEnded[transitionStartCounter] = false;
        // by default not all transitions has transision end event called for
        // example when parameter is the same as before change, so
        // it's necassary to manualy trigger this event
        $rotationLayer.off();
        $rotationLayer.on(transitionEndEvent, function(e, startedManually) {
            if (!startedManually) {
                transitionEndCounter++;
            }

            transitionsEnded[transitionEndCounter] = true;
            if (transitionEndCounter !== transitionStartCounter) {
				main.log("return, transitionEndCounter = "+transitionEndCounter+" transitionStartCounter = "+transitionStartCounter);
                return;
            }

			$rotationLayer.off();
            blockPresentationMove = false;
			
			if( !zoomingBeforeRotation ){
				//if this is zooming out process before rotation, dont unblock here. Wait for unblocking in other place in code.
				//Unblocking here should be available only when user is manually zooming using zoom in/out buttons, scroll or pinch zoom
				zoomingBeforeRotation = false;
				that.unblockAllUserInteractions();
			}
			
			main.log("blockPresentationMove = "+blockPresentationMove);
            // this event is triggered for every transition end (left, top,
            // width, height and all margins) - run below code only once
            transitionsEnded.length = 0;
            transitionEndCounter = transitionStartCounter = 0;

            $rotationLayer.removeClass('animating');
            cssZoomTransitionInProgress = false;

            if ( ( pinchZoomingTouchEnd || !pinchZooming ) && !keyFramesMoveInProgress ) {
                // transition is over after touch end occures
                showImagesOnNewLayer(undefined, true);
            }
        });

        // it's important that this timeout is no smaller then transition time.
        // Transition time is now 0.2s, so 0.4s for timeout is enough
        setTimeout(function() {
            if (transitionsEnded[transitionEndCounter + 1] === false) {
                transitionEndCounter++;
                $rotationLayer.trigger(transitionEndEvent, true);
            }
        }, 500);
    };

    function refreshScreenMode() {
        // timeout is needed for android stock browsers. They need more time to
        // calculate window width and height after rotation.
		if (jQuery("body").data("fullscreen-market360-target") != that ) {
			return;
		}
        setTimeout(function() {
            if (isFullScreenActive()) {
                adjustPresentationToFullScreen();
            } else {
                adjustPresentationToNormalScreen();
            }
        }, 500);
    }

    function stopAutoRotation() {
        $rotateButton.removeClass("pause");
        autoRotationInProgress = false;
        clearTimeout(rotationDelayTimeout);
		clearInterval(initialInterval);
        clearInterval(rotationInterval);
		clearInterval(endInterval);
        rotationInterval = undefined;
    }

    function resetSrcAttributeOfActiveLayer() {
        var images = that.$activeLayer.find(".imageContainer");
        for (var i = 0; i < images.length; i++) {
            images[i].style.backgroundImage = "";
            images[i].style.opacity = 0;
        }
    }

    function refreshControlButtons(pinchZoomLevelIndex) {
        var localZoomLevelIndex;
        if (that.zoomLevelIndex === 0) {
            $zoomOutButton.addClass("buttonDisabled");
            $rotateButton.removeClass('buttonDisabled');
        }

        if (typeof pinchZoomLevelIndex !== "undefined") {
            localZoomLevelIndex = pinchZoomLevelIndex;
        } else {
            localZoomLevelIndex = that.zoomLevelIndex;
        }

        if (localZoomLevelIndex === lastAvailableZoomLevelIndex) {
            $zoomInButton.addClass("buttonDisabled");
        }

        if (localZoomLevelIndex > minZoomLevelIndex) {
            $zoomOutButton.removeClass("buttonDisabled");
			if( keyFrames.length === 0 ){
				$rotateButton.addClass('buttonDisabled');
			}
        }

        if (localZoomLevelIndex === minZoomLevelIndex) {
            $zoomOutButton.addClass("buttonDisabled");
            $rotateButton.removeClass('buttonDisabled');
        }

        if (localZoomLevelIndex < lastAvailableZoomLevelIndex) {
            $zoomInButton.removeClass("buttonDisabled");
        }

        if (keyFrames.length > 0 && !keyFramesLoaded){
        	$rotateButton.addClass("buttonDisabled");
        }else if( keyFrames.length > 0 ){
			$rotateButton.removeClass("buttonDisabled");
		}
		
		$leftButton.removeClass("buttonDisabled");
		$rightButton.removeClass("buttonDisabled");
		$fullscreenButton.removeClass("buttonDisabled");
    }

    var doZooming = function(zoomLevelIndex) {
        if (Modernizr.csstransitions) {
            cssZoomTransitionInProgress = true;
            $rotationLayer.addClass('animating');
            that.$activeLayer.find("*").remove();
            setPreviousLayerValues();
            showRotationLayer(true);
			that.blockAllUserInteractions();
        } else {
            showImagesOnNewLayer();
        }

        newWidth = zoomArray[zoomLevelIndex] * tilesDimensions[zoomLevelIndex].width;
        newHeight = zoomArray[zoomLevelIndex] * tilesDimensions[zoomLevelIndex].height;

        // if it is min zoom level - set newWidth and newHeight again - there
        // could be one extra resizing
        resizeMinZoomImagesToFitPresentationWindow(currentZoomIndex, true);

        centerLayerAfterZoom(newWidth, newHeight, true);

        setRotationLayerTransitionParameters();
		
		zoomingBeforeRotation = false;
    };

    function setRotationLayerTransitionParameters() {
        $rotationLayer.height(newHeight);
        $rotationLayer.css("top", newTop + "px");
        $rotationLayer.css("margin-top", newMarginTop + "px");

        $rotationLayer.width(newWidth);
        $rotationLayer.css("left", newLeft + "px");
        $rotationLayer.css("margin-left", newMarginLeft + "px");

        that.$activeLayer.css("left", newLeft + "px");
        that.$activeLayer.css("top", newTop + "px");

        that.$activeLayer.css("margin-left", newMarginLeft + "px");
        that.$activeLayer.css("margin-top", newMarginTop + "px");

        increaseTransitionStartCoutnerBy(6);
    }

    var cssZoomTransitionInProgress = false;
    var zoomIn = function() {
        if (blockZoomDuringMove) {
            return;
        }
		
		that.blockAllUserInteractions();

        if (that.zoomLevelIndex < lastAvailableZoomLevelIndex) {
            if (cssZoomTransitionInProgress) {
                return;
            }
            stopAutoRotation();
            previousZoomIndex = that.zoomLevelIndex;
            that.zoomLevelIndex += 1;
            currentZoomIndex = that.zoomLevelIndex;
            doZooming(that.zoomLevelIndex);
        }
		
		if( cssZoomTransitionInProgress === false ){
		   refreshControlButtons();
		}
    };

    var zoomOut = function() {

        if (blockZoomDuringMove) {
            return;
        }
		
		that.blockAllUserInteractions();

        if (that.zoomLevelIndex > minZoomLevelIndex) {
            if (cssZoomTransitionInProgress) {
                return;
            }
            previousZoomIndex = that.zoomLevelIndex;
            that.zoomLevelIndex -= 1;
            currentZoomIndex = that.zoomLevelIndex;
            doZooming(that.zoomLevelIndex);
        }

   		if( cssZoomTransitionInProgress === false ){
		   refreshControlButtons();
		}
    };

    var showImagesOnNewLayer = function(callback, zooming) {
        that.$activeLayer.find("*").remove();

        if (that.zoomLevelIndex === minZoomLevelIndex) {
            setUpFirstZoomLayerWithProperQualityImages();
        } else {
            that.$activeLayer = $mainPresentationContainer.find(".zoomLayer.zoomLayerId-" + that.zoomLevelIndex + "_" + zoomArray[that.zoomLevelIndex])
        }
        if (!zooming) {
            setPreviousLayerValues();
        }

        if (that.zoomLevelIndex === 0) {
            resizeMinZoomImagesToFitPresentationWindow(currentZoomIndex,
                zooming);
            currentZoomIndex = that.zoomLevelIndex;
            centerLayerAfterZoom();
            pinchZooming = false;
            return;
        }

        if (autoRotationInProgress) {
            stopAutoRotation();
        }

        resetSrcAttributeOfActiveLayer();
        jQuery(".zoomLayer").hide();

        buildImagesGrid(
            function(callback, zooming) {
                return function() {

                    if (pinchZooming) {
                        that.$activeLayer.css("left", $rotationLayer
                            .position().left);
                        that.$activeLayer.css("top", $rotationLayer
                            .position().top);
                        that.$activeLayer.width(newWidth);
                        that.$activeLayer.height(newHeight);

                        that.$activeLayer
                            .css("margin-left", parseInt($rotationLayer
                                .css("margin-left")));
                        that.$activeLayer.css("margin-top",
                            parseInt($rotationLayer.css("margin-top")));
                    }

                    resizeMinZoomImagesToFitPresentationWindow(
                        that.zoomLevelIndex, zooming);

                    if (!pinchZooming) {
                        centerLayerAfterZoom();
                    } else {
                        pinchZooming = false;
                    }

                    prepareVisibleImagesNumbersArray();

                    if (callback) {
                        callback();
                    }
                };
            }(callback, zooming), zooming);
    };

    function setUpFirstZoomLayerWithProperQualityImages() {
        that.zoomLevelIndex = 0;
        if ($outerWrapper.width() - tilesDimensions[0].width > $outerWrapper.height() - tilesDimensions[0].height) {
            for (var i = 0; i < zoomArray.length; i++) {
				if (($outerWrapper.height() > zoomArray[i] * tilesDimensions[i].height) && zoomArray[i + 1] !== undefined) {
                    that.zoomLevelIndex = i + 1;
				} else if (($outerWrapper.height() > zoomArray[i] * tilesDimensions[i].height) && zoomArray[i] !== undefined) {
                    that.zoomLevelIndex = i;
                }
            }
        } else {
            for (var i = 0; i < zoomArray.length; i++) {
                if (($outerWrapper.width() > zoomArray[i] * tilesDimensions[i].width) && zoomArray[i + 1] !== undefined) {
                    that.zoomLevelIndex = i + 1;
                } else if (($outerWrapper.width() > zoomArray[i] * tilesDimensions[i].width) && zoomArray[i] !== undefined) {
                    that.zoomLevelIndex = i;
                }
            }
        }

        if (that.zoomLevelIndex > lastAvailableZoomLevelIndex) {
            that.zoomLevelIndex = lastAvailableZoomLevelIndex;
            if (that.zoomLevelIndex > 0) {
                main.warn("Zoom level has been limited");
            } else {
                main.warn("There is no such zoom level in the array");
            }
        }

        currentZoomIndex = that.zoomLevelIndex;

        minZoomLevelIndex = that.zoomLevelIndex;

        that.$activeLayer = $mainPresentationContainer.find(".zoomLayer.zoomLayerId-" + that.zoomLevelIndex + "_" + zoomArray[that.zoomLevelIndex])
        that.$activeLayer.css("left", "0");
        that.$activeLayer.css("top", "0");

        $rotationLayer.css("left", "0");
        $rotationLayer.css("top", "0");
        increaseTransitionStartCoutnerBy(2);

        if (minZoomLevelIndex === lastAvailableZoomLevelIndex) {
            $zoomOutButton.addClass("buttonDisabled");
            $zoomInButton.addClass("buttonDisabled");
        }

    }

    function increaseTransitionStartCoutnerBy(value) {
        if ($rotationLayer.hasClass("animating")) {
            for (var i = 0; i < value; i++) {
                transitionStartCounter++;
                emulateTransitionEnd();
            }
        }
    }

    var resizedWidth, resizedHeight;

    function resizeMinZoomImagesToFitPresentationWindow(currentZoomLevelIndex, zooming) {

        if (currentZoomLevelIndex === minZoomLevelIndex) {

            if ($outerWrapper.width() > $outerWrapper.height()) {
                // adjust images to maximal possible width. Scale height
                // according to width scaling ratio
                resizedWidth = $outerWrapper.width() / zoomArray[minZoomLevelIndex];
                resizedHeight = tilesDimensions[minZoomLevelIndex].height * (resizedWidth / tilesDimensions[minZoomLevelIndex].width);

                if (resizedHeight * zoomArray[minZoomLevelIndex] > $outerWrapper.height()) {
                    // reduce height
                    resizedHeight = $outerWrapper.height() / zoomArray[minZoomLevelIndex];
                    resizedWidth = tilesDimensions[minZoomLevelIndex].width * (resizedHeight / tilesDimensions[minZoomLevelIndex].height);
                }

            } else {
                // adjust images to maximal possible height. Scale width
                // according to height scaling ratio
                resizedHeight = $outerWrapper.height() / zoomArray[minZoomLevelIndex];
                resizedWidth = tilesDimensions[minZoomLevelIndex].width * (resizedHeight / tilesDimensions[minZoomLevelIndex].height);

                if (resizedWidth * zoomArray[minZoomLevelIndex] > $outerWrapper.width()) {
                    // reduce width
                    resizedWidth = $outerWrapper.width() / zoomArray[minZoomLevelIndex];
                    resizedHeight = tilesDimensions[minZoomLevelIndex].height * (resizedWidth / tilesDimensions[minZoomLevelIndex].width);
                }
            }

            resizedWidth = Math.floor(resizedWidth);
            resizedHeight = Math.floor(resizedHeight);

            that.$activeLayer.find(".imageContainer").width(resizedWidth);
            that.$activeLayer.find(".imageContainer").height(resizedHeight);

            var tileWidthResizedScale = resizedWidth / tilesDimensions[minZoomLevelIndex].width;
            var tileHeightResizedScale = resizedHeight / tilesDimensions[minZoomLevelIndex].height;

            if (zoomArray[minZoomLevelIndex] > 1) {
                that.$activeLayer.find(".imageContainer").css(
                    "background-size", (resizedWidth + tileMargin * 2) + "px " + (resizedHeight + tileMargin * 2) + "px");
                that.$activeLayer.find(".imageContainer").css(
                    "background-position", -tileMargin * tileWidthResizedScale + "px " - tileMargin * tileHeightResizedScale + "px");
            } else {
                that.$activeLayer.find(".imageContainer").css(
                    "background-size", (resizedWidth) + "px " + (resizedHeight) + "px");
            }

            that.$activeLayer.width(resizedWidth * zoomArray[minZoomLevelIndex]);
            that.$activeLayer.height(resizedHeight * zoomArray[minZoomLevelIndex]);

            newWidth = that.$activeLayer.width();
            newHeight = that.$activeLayer.height();

            if (!newWidth || !newHeight) {
                // in case of the first function call - there is no activeLayer
                // yet (for example for first zoom level) - only rotation layer
                // is present
                newWidth = resizedWidth;
                newHeight = resizedHeight;
            }

            if (!zooming) {
                centerLayerAfterZoom(newWidth, newHeight);
                $rotationLayer.width(newWidth);
                $rotationLayer.height(newHeight);
                increaseTransitionStartCoutnerBy(2);
            }
        }
    }

    var getDistance = function(touches) {
        var xDistance = touches[0].clientX - touches[1].clientX;
        var yDistance = touches[0].clientY - touches[1].clientY;
        return Math.ceil(Math.sqrt(xDistance * xDistance + yDistance * yDistance));
    };

    var blockHorizontalDrag = false,
        blockVerticalDrag = false;

    var previousDistance = 0;
    var currentDistance = 0;

    var pinchZoomLevelIndex = 1;
    var pinchZooming = false;
    var lastMoveEventDetectedMilis;
    var distanceMoved = 0;
	var distanceMovedFromStartY = 0;
	var distanceMovedFromStartX = 0;
    var touchesArray;
    var pointer1InsidePresentationWindow, pointer2InsidePresentationWindow;
	var keyFramesMoveInProgress = false;
    var moveEvent = function(event) {

		event.preventDefault();

        // block move event during IE pinch zoom gesture or move event during key frame animations
        if (iePinchGestureInProgress || blockAllUserInteractions ) {
            return;
        }	
        touchesArray = event.originalEvent.touches;
        event = getProperEvent(event); // return only touches[0]

        pointer1InsidePresentationWindow = event.pageX >= $outerWrapper
            .offset().left && event.pageX <= $outerWrapper.offset().left + $outerWrapper.width() && event.pageY >= $outerWrapper.offset().top && event.pageY <= $outerWrapper.offset().top + $outerWrapper.height();

        // there is no touches array in IE browser and it's impossible to
        // determine which finger it is - for every finger separated event is
        // fired, so omit the code below for touch IE
//        if (isTouch && !navigator.maxTouchPoints && touchesArray.length > 1) {
		if (isTouch && touchesArray.length > 1) {
            if (touchesArray[1]) {
                pointer2InsidePresentationWindow = touchesArray[1].pageX >= $outerWrapper
                    .offset().left && touchesArray[1].pageX <= $outerWrapper.offset().left + $outerWrapper.width() && touchesArray[1].pageY >= $outerWrapper.offset().top && touchesArray[1].pageY <= $outerWrapper.offset().top + $outerWrapper.height();
            } else {
                pointer2InsidePresentationWindow = undefined;
            }

            if (zoomEnabled === ZOOM_ENABLED && pointer1InsidePresentationWindow && pointer2InsidePresentationWindow) {
                // both fingers should be in the presentation window boundaries
                pinchZooming = true;
                pinchZoomingTouchEnd = false;
                currentDistance = getDistance(touchesArray);
                if (previousDistance > 0) {
                    distanceMoved += Math.abs(currentDistance - previousDistance);
                }

                if (pinchZoomLevelIndex < lastAvailableZoomLevelIndex && currentDistance > previousDistance && distanceMoved > 100) {
                    pinchZoomIn();
                } else if (pinchZoomLevelIndex > minZoomLevelIndex && currentDistance < previousDistance && distanceMoved > 100) {
                    pinchZoomOut();
                }
                previousDistance = currentDistance;
                return;
            }
        }

        if (minZoomLevelIndex < that.zoomLevelIndex && pointer1InsidePresentationWindow && !pinchZooming) {
            // moving enlarged presentation

            if (!mouseStartHandled) {
                mouseStartHandled = true;
                mouseStartXOffset = event.pageX - $rotationLayer.offset().left;
                mouseStartYOffset = event.pageY - $rotationLayer.offset().top;
            }

            y = event.pageY - $outerWrapper.offset().top - mouseStartYOffset;
            x = event.pageX - $outerWrapper.offset().left - mouseStartXOffset;

            /*
             * show rotation layer only when there are new images to download,
             * otherwise we show higher quality images
             */

            if (that.zoomLevelIndex > 0 && isAnyActiveLayerContainerWithoutImage() && $rotationLayer.css("z-index") === "auto") {
                showRotationLayer(false);
            }

            // check presentation container limits and block move if necessary
            blockHorizontalDrag = false;
            blockVerticalDrag = false;

            if (x > 0 || (x + $rotationLayer.width() < $outerWrapper.width())) {
                blockHorizontalDrag = true;
            }

            if (y > 0 || (y + $rotationLayer.height() < $outerWrapper.height())) {
                blockVerticalDrag = true;
            }

            if (!blockHorizontalDrag) {
                that.$activeLayer.css("left", x);
                $rotationLayer.css("left", x);
                increaseTransitionStartCoutnerBy(1);
            }

            if (!blockVerticalDrag) {
                that.$activeLayer.css("top", y);
                $rotationLayer.css("top", y);
                increaseTransitionStartCoutnerBy(1);
            }

        } else if (that.zoomLevelIndex === minZoomLevelIndex && !pinchZooming) {
            // manual rotation / move to next key frame in key frame mode active
			
            distanceMoved += Math.abs(event.pageX - xPrevious);
			
			if( yPrevious > 0 && xPrevious > 0 ){
				distanceMovedFromStartX += Math.abs(event.pageX - xPrevious);
				distanceMovedFromStartY += Math.abs(event.pageY - yPrevious);

				console.log("distanceMovedFromStartX = "+distanceMovedFromStartX);
				console.log("distanceMovedFromStartY = "+distanceMovedFromStartY);
			}
			
            if (!manualRotationInProgress || distanceMoved < manualRotationStep ) {
                return;
            }
            var framesToStep = Math.floor(distanceMoved / manualRotationStep);
            framesToStep > 4 ? framesToStep = 4 : null;
            distanceMoved = 0;

            if ( !moving && !keyFramesModeActive ) {
                showRotationLayer(false);
                moving = true;
            }
			
			var _scrollval = 0;
			if(isTouch && !isFullScreenActive() && distanceMovedFromStartX < distanceMovedFromStartY ) {
	            _scrollval =  ( yPrevious === 0 ? event.pageY : yPrevious) - event.pageY;
				jQuery('body').scrollTop( jQuery('body').scrollTop() + _scrollval >= 0 ?  jQuery('body').scrollTop() + _scrollval : 0);
            }
			
            if ( xPrevious !== 0 && distanceMovedFromStartX >= distanceMovedFromStartY ) {
                deltaX = xPrevious - event.pageX;
                if (event.pageX < xPrevious) {
					globalRotateDirection = ROTATE_RIGHT;
					if ( keyFramesModeActive ) {
						keyFramesMoveInProgress = true;
						showNextKeyFrame(ROTATE_RIGHT);
						jQuery(window).off(MOVE_EV);
					}else{
						countNewCurrentImageIndex( framesToStep );
						skipKeyFrame();
						that.setFrameImageSrc();
					}
                } else if (event.pageX > xPrevious) {
					globalRotateDirection = ROTATE_LEFT;
					if ( keyFramesModeActive ) {
						keyFramesMoveInProgress = true;
						showNextKeyFrame(ROTATE_LEFT);
						jQuery(window).off(MOVE_EV);
					}else{
						countNewCurrentImageIndex( framesToStep );
						skipKeyFrame();
						that.setFrameImageSrc();
					}
                }
            }
        }

        xPrevious = event.pageX;
        yPrevious = event.pageY + _scrollval;
        lastMoveEventDetectedMilis = Date.now();
    };

    function pinchZoomIn() {
        if (cssZoomTransitionInProgress) {
            return;
        }
        distanceMoved = 0;
        cssZoomTransitionInProgress = true;
        $rotationLayer.addClass('animating');
        previousZoomIndex = pinchZoomLevelIndex;
        pinchZoomLevelIndex++;
        showRotationLayer(true);

        currentZoomIndex = pinchZoomLevelIndex;

        setPreviousLayerValues();

        newWidth = zoomArray[pinchZoomLevelIndex] * tilesDimensions[pinchZoomLevelIndex].width;
        newHeight = zoomArray[pinchZoomLevelIndex] * tilesDimensions[pinchZoomLevelIndex].height;

        centerLayerAfterZoom(newWidth, newHeight, true);
        setRotationLayerTransitionParameters();
        jQuery(".zoomLayer").hide();

        refreshControlButtons(pinchZoomLevelIndex);
    }

    function pinchZoomOut() {
        if (cssZoomTransitionInProgress) {
            return;
        }
        distanceMoved = 0;
        cssZoomTransitionInProgress = true;
        $rotationLayer.addClass('animating');
        previousZoomIndex = pinchZoomLevelIndex;
        pinchZoomLevelIndex--;

        showRotationLayer(true);

        currentZoomIndex = pinchZoomLevelIndex;

        setPreviousLayerValues();

        newWidth = zoomArray[pinchZoomLevelIndex] * tilesDimensions[pinchZoomLevelIndex].width;
        newHeight = zoomArray[pinchZoomLevelIndex] * tilesDimensions[pinchZoomLevelIndex].height;

        jQuery(".zoomLayer").hide();

        if (pinchZoomLevelIndex === minZoomLevelIndex) {
            resizeMinZoomImagesToFitPresentationWindow(pinchZoomLevelIndex,
                true);
        }

        centerLayerAfterZoom(newWidth, newHeight, true);
        setRotationLayerTransitionParameters();

        refreshControlButtons(pinchZoomLevelIndex);
    }
	
	function countNewCurrentImageIndex( framesCountToMove ){
		//rotation direction fix - some presentations' frames are in wrong order - reverse displaying order
		
		if( that.currentImageIndex + framesCountToMove > framesCount || ( keyFrames.indexOf( that.currentImageIndex + framesCountToMove ) !== -1 ) ) {
			//safety condition - when framesCountToMove is greater than 1 there is possibility that next that.currentImageIndex will be out of bounds 
			//or next that.currentImageIndex will be key frame inside sequence of consecutive key frames. For safety reason, set framesCountToMove to 1
			framesCountToMove = 1;
		}
		
		if( autoRotationDirection === ROTATE_LEFT ){
			if( globalRotateDirection === ROTATE_LEFT ){
				that.currentImageIndex -= framesCountToMove;
			}else{
				if( !keyFramesModeActive ){
					if( keyFrames.length === 0 || !( keyFrames.length > 0 && autoRotationMode === PING_PONG_MODE && getKeyFramesCountToTheEndOfSequence() > 0 ) ){
						that.currentImageIndex += framesCountToMove;
					}else{
						that.currentImageIndex -= framesCountToMove;
					}
				}else{
					that.currentImageIndex += framesCountToMove;
				}
			}
		}else{
			//wrong rotation direction - reverse
			if( globalRotateDirection === ROTATE_LEFT ){
				if( !keyFramesModeActive ){
					if( keyFrames.length === 0 || !( keyFrames.length > 0 && autoRotationMode === PING_PONG_MODE && getKeyFramesCountToTheEndOfSequence() > 0 ) ){
						that.currentImageIndex += framesCountToMove;
					}
				}else{
					that.currentImageIndex += framesCountToMove;
				}
				
			}else{
				that.currentImageIndex -= framesCountToMove;
			}
		}
	}

    function showRotationLayer(autoRotation) {
        if (autoRotation === true) {
            $rotationLayer.css("z-index", 99);
        } else if (autoRotation === false) {
            var zIndexToSet = 2 * lastAvailableZoomLevelIndex - 2 * (that.zoomLevelIndex - 1) + 1;
            $rotationLayer.css("z-index", zIndexToSet);
        } else {
            // the z-index just below the active zoomLayer and just above the
            // next zoomLayer
            var zIndexToSet = 2 * lastAvailableZoomLevelIndex - 2 * (that.zoomLevelIndex - 1) - 1;
            $rotationLayer.css("z-index", zIndexToSet);
        }
    }

    var rotate = function(steps) {
        clearTimeout(rotationDelayTimeout);
        clearInterval(rotationInterval);
        rotationInterval = undefined;
        setRotateInterval(steps);
    };

    this.stopGlobalAutoRotation = function() {
        jQuery(".presentationContainer-market360").each(function() {
            var $api = jQuery(this);
            if ($api.data("market360-engine")) {
                var api = $api.data("market360-engine");
                api.stopAutoRotationExternal();
            }
            return true;
        });
    };
	
    this.stopAutoRotationExternal = function() {
        stopAutoRotation();
    };
	
    this.startAutoRotateWithDelay = function( isFirstRotation ) {
        $loadingDiv.hide();
        clearTimeout(rotationDelayTimeout);
        clearInterval(rotationInterval);
        rotationInterval = undefined;
		
		if( autoRotationDirection === ROTATE_LEFT ){
			globalRotateDirection = ROTATE_LEFT;
		}else if( startImageNumber !== 0 ) {
			//wrong direction - reverse, but only when reversed rotation is starting from other frame then 0, 
			//otherwise it does one unnecessary direction change, which is causing initial rotation 
			//is not stopping at the same frame it started from
			globalRotateDirection = ROTATE_LEFT;
		}
		
		resetPresentationState();
		
		if( isFirstRotation ){
			if( autoRotationMode === NORMAL_MODE ){
				stepsToMove = 2 * ( framesCount - keyFrames.length );
			}else{
				stepsToMove = 2 * ( framesCount - keyFrames.length - 1 );
			}
			
			rotationDelayTimeout = setTimeout(function() {
				showRotationLayer(true);
				setStartSlowDownRotateInterval( true, function(){
					showImagesOnNewLayer();
				});
				
				if( keyFrames.length === 0 ){
					$rotateButton.addClass("pause");
				}
			}, autoRotationDelay);
		}else{
			rotationDelayTimeout = setTimeout(function() {
				showRotationLayer(true);
				setRotateInterval();
				if( keyFrames.length === 0 ){
					$rotateButton.addClass("pause");
				}
				that.unblockAllUserInteractions();
			}, autoRotationDelay);
		}
    };
	
	function resetPresentationState(){
		if( keyFrames.length > 0 ){
			keyFramesModeActive = false;
			$leftButton.removeClass("keyFrames");
			$rightButton.removeClass("keyFrames");
			$rotateButton.addClass("keyFrames");
		}
		
		if( that.zoomLevelIndex > minZoomLevelIndex ){
			that.zoomLevelIndex = minZoomLevelIndex;
			showImagesOnNewLayer();
		}
	}

    var setRotateInterval = function( steps, customInterval) {
		//function only for normal rotation mode (manual and slow down effect after fast mouse movement)

        autoRotationInProgress = true;
        var slowDownStepsRotated = 0;

        steps > MAX_STEPS_ON_DRAG_STOP ? steps = MAX_STEPS_ON_DRAG_STOP : steps;

        var timeInterval = parseInt(1000 / autoRotationFps);
        if (customInterval) {
            timeInterval = customInterval;
        }
        if (manualRotationInProgress && steps) {
            timeInterval = parseInt(timeInterval / steps);
            timeInterval < 20 ? timeInterval = 20 : timeInterval;
        }

        initRotateInterval(slowDownStepsRotated, timeInterval, steps);
		
    };
	
	var currentSlowDownTimes = 0;
	var stepsToSlowDown;
	function initRotateInterval(stepsRotated, timeInterval, steps) {
		//function only for normal rotation mode (manual and slow down effect after fast mouse movement)
		stepsToSlowDown = Math.ceil(steps / (ROTATION_SLOW_DOWN_LEVELS + 1));
		main.log("initRotateInterval");
		rotationInterval = setInterval(function() {
			if (autoRotationMode === NORMAL_MODE || manualRotationInProgress) { 
				//we dont do ping pong while rotating image manualy, by hand
				countNewCurrentImageIndex( 1 );
				skipKeyFrame();
				that.setFrameImageSrc();
			} else if (autoRotationMode === PING_PONG_MODE) {
				changePinPongDirectionIfNeeded();
				countNewCurrentImageIndex( 1 );
				skipKeyFrame();
				that.setFrameImageSrc();
			}

			stepsRotated += 1;

			if (stepsRotated === steps || currentSlowDownTimes > ROTATION_SLOW_DOWN_LEVELS) {
				main.log("STOP");
				autoRotationInProgress = false;
				clearInterval(rotationInterval);
				rotationInterval = undefined;
				currentSlowDownTimes = 0;
				showImagesOnNewLayer();
			}

			if (currentSlowDownTimes < ROTATION_SLOW_DOWN_LEVELS && stepsRotated < steps && (stepsRotated % stepsToSlowDown) === 0) {
				console.warn("Slow down rotation");
				currentSlowDownTimes++;
				clearInterval(rotationInterval);
				rotationInterval = undefined;
				stepsRotated = 0;
				initRotateInterval(stepsRotated, timeInterval * SLOW_DOWN_BY_TIMES, Math.ceil(steps / 2));
			}
		}, timeInterval);
	}
	
	var setStartSlowDownRotateInterval = function( isFirstRotation, callback) {
		//function only for rotation with accelarate and slow down effects (first rotation 2 * 360 degrees and key frames rotations)

        autoRotationInProgress = true;

        stepsToMove > MAX_STEPS_ON_DRAG_STOP ? stepsToMove = MAX_STEPS_ON_DRAG_STOP : stepsToMove;

        var timeInterval = 0;
		if( keyFramesModeActive ){
			//for key frames mode get rotation speed from configuration file
			if( stepsToMove > ( framesCount - keyFrames.length ) ){
				//rotation more than 360 degrees - fast rotation
				timeInterval = parseInt(1000 / fastRotationFps);
			}else{
				//rotation less than 360 degrees - slow rotation
				timeInterval = parseInt(1000 / slowRotationFps );
			}
		}else{
			if( !isFirstRotation ){
				timeInterval = parseInt(1000 / autoRotationFps);
			}else{
				timeInterval = parseInt(1000 / initialRotationFps);
			}
		}
		
		
        if (manualRotationInProgress && stepsToMove) {
            timeInterval = parseInt(timeInterval / stepsToMove);
            timeInterval < 20 ? timeInterval = 20 : timeInterval;
        }

        initStartSlowRotateInterval( timeInterval, callback);
	};
	
	var rotatedSteps = 0;
	var START_END_SECTION_DIVIDER = 5;
	function initStartSlowRotateInterval( middleIntervalTime, callback) {
		var boundaryIntervalTime = middleIntervalTime * 3; //start and stop
		var startEndSectionsFramesCount = Math.round( stepsToMove / START_END_SECTION_DIVIDER );
		var middleSectionFramesCount = stepsToMove - 2 * startEndSectionsFramesCount;
		rotatedSteps = 0;
		
		if( stepsToMove === 0 ){
			//current frame is the frame next to key frame, don't rotate - just show the key frame
			$rotationLayer.find(".keyFrame").css('opacity',0);
			if( callback ){
				callback();
			}
			return;
		}
		
		if( startEndSectionsFramesCount < START_END_SECTION_DIVIDER ){
			//if there is not enough steps, use just one rotation speed
			initialInterval = setInterval(function() {
				intervalFunction();
				if( rotatedSteps >= stepsToMove  ){
					stopAutoRotation();
					if( !keyFramesModeActive ){
						//first rotation end ( 2 * 360 degrees )
						that.unblockAllUserInteractions();
					}
					$rotationLayer.find(".keyFrame").css('opacity',0);
					if( callback ){
						callback();
					}
				}
			}, middleIntervalTime);
		}else{
			initialInterval = setInterval(function() {
				//start part of rotation
//				main.log("initialInterval, interval = "+boundaryIntervalTime);
				intervalFunction();

				if( rotatedSteps >= startEndSectionsFramesCount && rotatedSteps < startEndSectionsFramesCount + middleSectionFramesCount ){
					//middle part of rotation
					clearInterval(initialInterval);
					rotationInterval = setInterval(function() {
//						main.log("rotationInterval, interval = "+middleIntervalTime);
						intervalFunction();

						if( rotatedSteps >= startEndSectionsFramesCount + middleSectionFramesCount && rotatedSteps < 2 * startEndSectionsFramesCount + middleSectionFramesCount ){
							//end part of rotation
							clearInterval(rotationInterval);
							endInterval = setInterval(function() {
//								main.log("endInterval, interval = "+boundaryIntervalTime);
								intervalFunction();
								if( rotatedSteps >= stepsToMove  ){
									stopAutoRotation();
									if( !keyFramesModeActive ){
										//first rotation end ( 2 * 360 degrees )
										that.unblockAllUserInteractions();
									}
									if( callback ){
										callback();
									}
								}
							}, boundaryIntervalTime);
						}
					}, middleIntervalTime);
				}
			}, boundaryIntervalTime);
		}
	}

	var intervalFunction = function() {
		
		if( rotatedSteps === 1 ){
			//after rotation has been started - hide all key frames. 
			//Putting this in the setFrameImageSrc (rotation end is too late - opacity changing mechanism is some kind of broken )
			$rotationLayer.find(".keyFrame").css('opacity',0);
		}
		
		if (autoRotationMode === NORMAL_MODE ) { 
			rotatedSteps++;
			countNewCurrentImageIndex( 1 );
			skipKeyFrame();
			that.setFrameImageSrc();
		} else {	
			if( !keyFramesModeActive ){
				changePinPongDirectionIfNeeded();
			}
			rotatedSteps++;
			countNewCurrentImageIndex( 1 );
			skipKeyFrame();
			that.setFrameImageSrc();

		}
	};
	
	function changePinPongDirectionIfNeeded(){
		if( keyFrames.length === 0 ){
			if ( that.currentImageIndex % (framesCount - 1) === 0 ){
				main.log("change direction 1");
				if (globalRotateDirection === ROTATE_LEFT) {
					globalRotateDirection = ROTATE_RIGHT;
				} else {
					globalRotateDirection = ROTATE_LEFT;
				}
			}
		}else{
			var keyFramesCountToTheEndOfSequence = getKeyFramesCountToTheEndOfSequence();
			if( keyFramesModeActive ){
				if (autoRotationDirection === ROTATE_LEFT) {
					if (that.currentImageIndex % (framesCount - 1) === 0 && !(globalRotateDirection === ROTATE_RIGHT && that.currentImageIndex === 0) && !(globalRotateDirection === ROTATE_LEFT && that.currentImageIndex === framesCount ) || ( globalRotateDirection === ROTATE_RIGHT && keyFramesCountToTheEndOfSequence > 0 ) ) {
						//don't change direction when rotation is starting from index 0 (normal frame before key frame) and rotation is goind forward 0,2,3. 1 is key frame
						if( previousKeyFrameIndex !== framesCount - 1  ){
							//if the key frame we start from is not the last frame of sequence
							stepsToMove -= keyFramesCountToTheEndOfSequence;
						}
						
						if( firstKeyFrameAnimationDuringEntering && that.currentImageIndex + keyFramesCountToTheEndOfSequence === framesCount - 1 && keyFramesCountToTheEndOfSequence > 0 ){
							//last frame is the key frame and because rotation never reaches the last frame in this situation, decrease stepsToMove
							stepsToMove -= 1;
						}
						
						main.log("change direction 2, stepsToMove = "+stepsToMove);
						
						if (globalRotateDirection === ROTATE_LEFT) {
							globalRotateDirection = ROTATE_RIGHT;
						} else {
							globalRotateDirection = ROTATE_LEFT;
						}
					}
				} else {
					if (that.currentImageIndex % (framesCount - 1) === 0 && !(globalRotateDirection === ROTATE_LEFT && that.currentImageIndex === 0) && !(globalRotateDirection === ROTATE_RIGHT && that.currentImageIndex === framesCount ) || ( globalRotateDirection === ROTATE_LEFT && keyFramesCountToTheEndOfSequence > 0 ) ) {
						//don't change direction when rotation is starting from index 0 (normal frame before key frame) and rotation is goind forward 0,2,3. 1 is key frame
						
						if( previousKeyFrameIndex !== framesCount - 1  ){
							//if the key frame we start from is not the last frame of sequence
							stepsToMove -= keyFramesCountToTheEndOfSequence;
						}
						
						if( firstKeyFrameAnimationDuringEntering && that.currentImageIndex + keyFramesCountToTheEndOfSequence === framesCount - 1 && keyFramesCountToTheEndOfSequence > 0 ){
							//last frame is the key frame and because rotation never reaches the last frame in this situation, decrease stepsToMove
							stepsToMove -= 1;
						}
						
						main.log("change direction 3, stepsToMove = "+stepsToMove);
						if (globalRotateDirection === ROTATE_LEFT) {
							globalRotateDirection = ROTATE_RIGHT;
						} else {
							globalRotateDirection = ROTATE_LEFT;
						}
					}
				}
			}else{
				//normal ping-pong rotation
				if ( that.currentImageIndex % (framesCount - 1) === 0 || keyFramesCountToTheEndOfSequence > 0 ){
					main.log("change direction 4");
					if (globalRotateDirection === ROTATE_LEFT) {
						globalRotateDirection = ROTATE_RIGHT;
					} else {
						globalRotateDirection = ROTATE_LEFT;
					}
				}
			}
		}
	}
	
	function getKeyFramesCountToTheEndOfSequence(){
		var count = 0;
		for( var i = that.currentImageIndex + 1; i < framesCount; i++ ){
			if( keyFrames.indexOf( i ) === -1 ){
				return 0;
			}
			count++;
		}
//		main.log("Ping pong mode - multiple key frames at the end of the frames sequence, count = "+count);
		return count;
	}
	
	function skipKeyFrame(){
		//don't show key frames when auto rotation is in progress
		if( keyFrames.indexOf( that.currentImageIndex ) !== -1 ){
			if( firstKeyFrameAnimationDuringEntering ){
				//ater entering key frame mode, first key frame should be visible. 
				//decresing here is needed because during first entering to key frames mode
				//rotation can run through many key frames while normal rotation in key frames 
				//mode jumps between key frames (only normal frames between two neigbours key frames)
				stepsToMove--;
			}
			
			console.log("skipKeyFrame, that.currentImageIndex = "+that.currentImageIndex);
			countNewCurrentImageIndex( 1 );
			if( keyFrames.indexOf( that.currentImageIndex ) !== -1 ){
				main.log("AGAINNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN");
				skipKeyFrame();
			}
		}
	}
	
	var nextKeyFrameIndex = -1;
	var previousKeyFrameIndex = 0;
	var stepsToMove = 0;
	var firstKeyFrameAnimationDuringEntering;
	var consecutiveKeyFramesCount = 0;
	var jumpThroughFirstAndLastKeyFramesBorderNeeded = false;
	function showNextKeyFrame( direction ){
		var nextKeyFrameSet = false;
		that.blockAllUserInteractions();
		showRotationLayer(true);
		keyFramesMoveInProgress = true;
		globalRotateDirection = direction;
		rotatedSteps = 0;
		jumpThroughFirstAndLastKeyFramesBorderNeeded = false;
		if (minZoomLevelIndex < currentZoomIndex){
			//if image is zoomed, zoom out and then start rotation
            previousZoomIndex = minZoomLevelIndex + 1;
            that.zoomLevelIndex = minZoomLevelIndex;
            currentZoomIndex = that.zoomLevelIndex;
			doZooming(minZoomLevelIndex);
			zoomingBeforeRotation = true;

			var testingZoom = setInterval( function(){
				if ( !cssZoomTransitionInProgress ){
					clearInterval( testingZoom );
					showNextKeyFrame( globalRotateDirection );
					return 0;
				}
			}, 15 );
			return 0;
		}

		if( typeof globalRotateDirection === "undefined" ){
			globalRotateDirection = autoRotationDirection;
		}
	
		if( autoRotationDirection === ROTATE_RIGHT ){
			//change direction for the time of counting stepsToMove for presentations with reversed order of frames
			globalRotateDirection = globalRotateDirection === ROTATE_LEFT ? ROTATE_RIGHT : ROTATE_LEFT;
		}
	
		//need to count consecutive key frames in both direction
		consecutiveKeyFramesCount = 0;
		countConsecutiveKeyFrames( ROTATE_LEFT, that.currentImageIndex );
		countConsecutiveKeyFrames( ROTATE_RIGHT, that.currentImageIndex );
		
		if( globalRotateDirection === ROTATE_RIGHT ){
			//show key frame after rotate button click or left arrow click. In case of rotate button click, direction is the same as autoRotationDirection
			
			if( firstKeyFrameAnimationDuringEntering ){
				nextKeyFrameIndex = keyFrames[0];
				nextKeyFrameSet = true;
				
			}else{
				for( var i = 0; i < keyFrames.length; i++ ){
					if( that.currentImageIndex < keyFrames[i] ){
						//found next key frame
						nextKeyFrameIndex = keyFrames[i];
						nextKeyFrameSet = true;
						break;
					}
				}

				if( !nextKeyFrameSet ){
					//currentImageIndex is bigger than any index in keyFrames array, so the next keyFrame is the first one - only for normal rotation mode.
					nextKeyFrameIndex = keyFrames[0];
					jumpThroughFirstAndLastKeyFramesBorderNeeded = true;
				}
			}
			
			if( firstKeyFrameAnimationDuringEntering && autoRotationMode === PING_PONG_MODE && that.currentImageIndex > nextKeyFrameIndex ){
				main.log("ROTATE_RIGHT ping pong extra frames to rotation!!!!!!!!!!");
				stepsToMove = framesCount - that.currentImageIndex + framesCount + nextKeyFrameIndex - 3;
			}else{
				stepsToMove = (framesCount + nextKeyFrameIndex - that.currentImageIndex) % framesCount;
			}
			
		}else{
			//show key frame after rotate button click or right arrow click. In case of rotate button click, direction is the same as autoRotationDirection
			
			if( firstKeyFrameAnimationDuringEntering ){
				nextKeyFrameIndex = keyFrames[0];
				nextKeyFrameSet = true;
				
			}else{
				for( var i = keyFrames.length - 1; i >= 0; i-- ){
					if( that.currentImageIndex > keyFrames[i] ){
						//found next key frame
						nextKeyFrameIndex = keyFrames[i];
						nextKeyFrameSet = true;
						break;
					}
				}

				if( !nextKeyFrameSet ){
					//currentImageIndex is smaller than any index in keyFrames array, so the next keyFrame is the last one - only for normal rotation mode.
					nextKeyFrameIndex = keyFrames[ keyFrames.length - 1 ];
					jumpThroughFirstAndLastKeyFramesBorderNeeded = true;
				}
				
			}
			
			if( firstKeyFrameAnimationDuringEntering && autoRotationMode === PING_PONG_MODE && that.currentImageIndex < nextKeyFrameIndex ){
				main.log("ROTATE_LEFT ping pong extra frames to rotation!!!!!!!!!!");
				if( that.currentImageIndex !== 0 ){
					stepsToMove = that.currentImageIndex + framesCount + framesCount - nextKeyFrameIndex - 2;
				}else{
					stepsToMove = that.currentImageIndex + framesCount + framesCount - nextKeyFrameIndex;
				}
				
			}else{
				stepsToMove = (framesCount - nextKeyFrameIndex + that.currentImageIndex) % framesCount;
			}
		}
		
		if( autoRotationDirection === ROTATE_RIGHT ){
			//change direction back to the original after counting stepsToMove for presentations with reversed order of frames
			globalRotateDirection = globalRotateDirection === ROTATE_LEFT ? ROTATE_RIGHT : ROTATE_LEFT;
		}
		
		if( autoRotationMode === PING_PONG_MODE && !nextKeyFrameSet ){
			//ping pong - add additional frames to rotate
			//!nextKeyFrameSet - next key frame is in the other end of the frames sequence
//			if( that.currentImageIndex === 1 || that.currentImageIndex === framesCount - keyFrames.length - 1 ){
			if( that.currentImageIndex === 0 || that.currentImageIndex === framesCount - keyFrames.length - 1 ){
				//first or last index
				stepsToMove += framesCount - keyFrames.length - 1;
			}else{
				//rotate to the first/last frame, rotate through all frames and continue to key frame (rotation direction change)
				//there is -2 because in this case there will be always 2 rotation direction changes. 
				//During single direction change there is one frame lost. For example: 3, 2, 1, 0, 1, 2, 3
				stepsToMove += framesCount - keyFrames.length - 2;
			}
			
			main.log("stepsToMove after ping-pong mode increasing = "+stepsToMove);
		}
		
		main.log("======================================");
		main.log("that.currentImageIndex = "+that.currentImageIndex);
		main.log("stepsToMove = "+stepsToMove);
		main.log("nextKeyFrameIndex = "+nextKeyFrameIndex);
		
		if( firstKeyFrameAnimationDuringEntering ){
			if( ( autoRotationDirection === ROTATE_RIGHT && globalRotateDirection === ROTATE_LEFT && autoRotationMode === PING_PONG_MODE && that.currentImageIndex < nextKeyFrameIndex ) 
				|| ( autoRotationDirection === ROTATE_RIGHT && globalRotateDirection === ROTATE_LEFT && autoRotationMode === NORMAL_MODE )
				|| ( autoRotationDirection === ROTATE_LEFT && autoRotationMode === PING_PONG_MODE && globalRotateDirection === ROTATE_RIGHT ) ){
				stepsToMove--;
			}
			that.startKeyFrameAnimation( globalRotateDirection, nextKeyFrameIndex);
		}else{
			if( Math.abs( previousKeyFrameIndex - nextKeyFrameIndex ) > 1 ){
				if( autoRotationMode ===  NORMAL_MODE ){
					//one additional rotation - normal rotation mode (not ping-pong)
					if( (Math.abs( previousKeyFrameIndex - nextKeyFrameIndex ) < ( framesCount - keyFrames.length ) / 6) && jumpThroughFirstAndLastKeyFramesBorderNeeded === false ){
						stepsToMove += framesCount - keyFrames.length;
						main.log("stepsToMove after normal mode increasing = "+stepsToMove);
					}else if( jumpThroughFirstAndLastKeyFramesBorderNeeded === true ){
						
						if( (previousKeyFrameIndex > nextKeyFrameIndex && (framesCount - 1 - previousKeyFrameIndex + nextKeyFrameIndex) < ( framesCount - keyFrames.length ) / 6)
							|| ( previousKeyFrameIndex < nextKeyFrameIndex && (framesCount - 1 - nextKeyFrameIndex + previousKeyFrameIndex) < ( framesCount - keyFrames.length ) / 6 )){
							stepsToMove += framesCount - keyFrames.length;
						}
					}
				}
				that.startKeyFrameAnimation( globalRotateDirection, nextKeyFrameIndex);
			}else if( previousKeyFrameIndex === nextKeyFrameIndex && keyFrames.length === 1 ){
				//only one key frame. Make one rotation and show the same key frame.
				if( autoRotationMode === NORMAL_MODE ){
					stepsToMove = framesCount - keyFrames.length + 1;
				}else{
					stepsToMove = 2 * (framesCount - keyFrames.length) - 1;
				}
				that.startKeyFrameAnimation( globalRotateDirection, nextKeyFrameIndex);
			}else{
				//two key frames next to each other - don't start rotate animation, just fade in next key frame
				that.setFrameImageSrc( nextKeyFrameIndex );
				previousKeyFrameIndex = nextKeyFrameIndex;
			}
		}
	}

	function countConsecutiveKeyFrames( direction, index ){
		
		if( direction === ROTATE_LEFT ){
			if( keyFrames.indexOf( --index ) !== -1 ){
				consecutiveKeyFramesCount++;	
				countConsecutiveKeyFrames( direction, index );
			}
		}else{
			if( keyFrames.indexOf( ++index ) !== -1 ){
				consecutiveKeyFramesCount++;	
				countConsecutiveKeyFrames( direction, index );
			}
		}
		return;
	}
	
	function setProperCurrentImageIndexBeforeRotation( direction ){
		// next/previous key frame animation should start from the frame before key frame. 
		// There is +2/-2 and not +1/-1 because later in the rotate interval that.currentImageIndex is increased/decreased at the start 
		// and +1/-1 is not enough
		
		if( typeof direction === "undefined" ){
			direction = autoRotationDirection;
		}
		
//		main.log("that.currentImageIndex before change = "+that.currentImageIndex);


		if( direction === ROTATE_RIGHT && autoRotationDirection === ROTATE_LEFT ){
			that.currentImageIndex = previousKeyFrameIndex - consecutiveKeyFramesCount - 2;
		}else if( direction === ROTATE_LEFT && autoRotationDirection === ROTATE_RIGHT ){
			that.currentImageIndex = previousKeyFrameIndex - consecutiveKeyFramesCount - 2;
		}
		
//		main.log("that.currentImageIndex after change = "+that.currentImageIndex);
//		main.log("consecutiveKeyFramesCount = "+consecutiveKeyFramesCount);
		
	}
	

    var getProperEvent = function(e) {
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length) {
            return e.originalEvent.touches[0];
        } else if (e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches.length) {
            return e.originalEvent.changedTouches[0];
        } else if (e.targetTouches && e.targetTouches.length) {
            return e.targetTouches[0];
        } else if (e.changedTouches && e.changedTouches.length) {
            return e.changedTouches[0];
        } else if (e.originalEvent) {
            // e.g. windows 8 touch devices
            return e.originalEvent;
        } else {
            return e;
        }
    };

	var $normalFrameToShow;
	var $keyFrame;
    this.setFrameImageSrc = function( nextKeyFrameIndex ) {
		
        if ( autoRotationMode === NORMAL_MODE ) {
            // rotate around
            if (that.currentImageIndex >= framesCount) {
                that.currentImageIndex = that.currentImageIndex % framesCount;
            } else if (that.currentImageIndex < 0) {
                that.currentImageIndex = framesCount + (that.currentImageIndex % framesCount);
            }
        } else {
            // ping-pong
			if( keyFrames.length === 0 ){
				if (that.currentImageIndex >= (framesCount)) {
					that.currentImageIndex = framesCount - 1;
				} else if (that.currentImageIndex < 0) {
					that.currentImageIndex = 0;
				}
			}else{
				if (that.currentImageIndex >= (framesCount - getKeyFramesCountToTheEndOfSequence() )) {
					that.currentImageIndex = framesCount - getKeyFramesCountToTheEndOfSequence() - 1;
				} else if (that.currentImageIndex < 0) {
					that.currentImageIndex = 0;
				}	
			}
        }

		if( autoRotationMode === PING_PONG_MODE && keyFramesModeActive ){
			changePinPongDirectionIfNeeded();
		}
		
		skipKeyFrame(); //function call needed here, because currentImageIndex after change above can point to keyFrame
		main.log("that.currentImageIndex = "+that.currentImageIndex);
		
		if( typeof nextKeyFrameIndex !== 'undefined' ){
			$keyFrame = $rotationLayer.find( ".imageContainerId-" + nextKeyFrameIndex );
			
			$keyFrame.one("webkitTransitionEnd transitionend oTransitionEnd otransitionend MSTransitionEnd transitionEnd", function(e) {
				that.currentImageIndex = nextKeyFrameIndex;
				main.log("[keyFrame] that.currentImageIndex = "+that.currentImageIndex);
				rotationLayerImages.removeClass("keyFrameFade");
				$rotationLayer.find(".keyFrame").not($keyFrame).css('opacity',0);
				rotationLayerImages.not($keyFrame).css('visibility','hidden');
				rotationLayerImages.css('z-index','');
				if ( minZoomLevelIndex > 0 ) {
					showImagesOnNewLayer();
				}
				keyFramesMoveInProgress = false;
				that.unblockAllUserInteractions();
				//handling situation when in fullscreen mode and during key frames rotation user wants to leave the full screen mode
				//for example using ESC button. In this situation wait with adjusting presentation to normal screen mode after animation end
				if( $controlsPanel.hasClass("fullscreen") && !isFullScreenActive() ){
					//browser fullscreen mode is off, but presentation has not been adjusted yet - was waiting for key frames animation end
					fullscreenChangeHandler();
				}
				
				if( firstKeyFrameAnimationDuringEntering ){
					firstKeyFrameAnimationDuringEntering = false;
				}
				
			});
			
			
			if( $keyFrame.css("opacity") === 1  ){
				var waitInterval = setInterval(function(){
					main.log("waiting for opacity to change");
					if( $keyFrame.css("opacity") === 0  ){
						clearInterval(waitInterval);
						$keyFrame.addClass("keyFrameFade");
						$keyFrame.css({
							"visibility":"visible",
							"opacity":1,
							"z-index":1
						});	
					}
				}, 50);
			}else{
				$keyFrame.addClass("keyFrameFade");
				$keyFrame.css({
					"visibility":"visible",
					"opacity":1,
					"z-index":1
				});	
			}
			
					
			
		}else{
			$normalFrameToShow = $rotationLayer.find( ".imageContainerId-" + that.currentImageIndex );
			rotationLayerImages.css('visibility', 'hidden');
			$normalFrameToShow.css('visibility',
				'visible');
		}
    };

    this.getImageSrc = function() {
        return presentationImagesUrls[that.currentImageIndex];
    };

    function scalePresentationToMinZoomLevel() {
        setPresentationWindowPosition();
        setUpFirstZoomLayerWithProperQualityImages();
        showImagesOnNewLayer();
    };

    var cookiesInfoWrapperDisplay;
    var adjustPresentationToFullScreen = function() {
		
		
		
		if( isAndroid ){
			document.querySelector('meta[name="viewport"]').content ="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no";
		}
		
        $controlsPanel.addClass("fullscreen");
        that.$activeLayer.find("*").remove();
        previousZoomIndex = that.zoomLevelIndex;

        if (zoomEnabled === ZOOM_ENABLED) {
            $zoomOutButton.addClass("buttonDisabled");
            $zoomInButton.removeClass("buttonDisabled");
        }

        $rotateButton.removeClass('buttonDisabled');
        $fullscreenButton.addClass('fullscreen');

        jQuery("body").css("overflow", "hidden");

        var browserZoomLevel = 1;
        if (!fullScreenFunction) {
            browserZoomLevel = document.documentElement.clientWidth / window.innerWidth;
            if (browserZoomLevel > 1 && isIPad){
                window.scrollTo(0, 0);
			}
        }

        var windowWidth = Math.round(jQuery(window).width() / browserZoomLevel);
        var windowHeight = Math.round(jQuery(window).height() / browserZoomLevel);

        manualRotationStep = parseInt((windowWidth / framesCount) * manualRotationInterval);

        $presentationInjectContainer.height(windowHeight);
        $presentationInjectContainer.width(windowWidth);

        // only presentation window should be visible in fullscreen mode
//        $("body").find("*").css("visibility", "hidden");
//        $presentationInjectContainer.css("visibility", "visible");
//        $presentationInjectContainer.find("*").css("visibility", "visible");
		$presentationInjectContainer.css("z-index", 2147483638);
        $rotationLayer.find("img").css("visibility", "hidden");
        $rotationLayer.find(".imageContainerId-" + that.currentImageIndex).css("visibility",
            "visible");

        cookiesInfoWrapperDisplay = jQuery("#cookiesInfoWrapper").css("display");
        jQuery("#cookiesInfoWrapper").css("display", "none");

        $presentationInjectContainer.css("position", "fixed");
        $presentationInjectContainer.css("left", "0");
        $presentationInjectContainer.css("top", "0");
        $presentationInjectContainer.css("background-color", "white");

        jQuery("html").css("position", "absolute");
        jQuery("html").css("left", "0");
        jQuery("html").css("top", "0");
        jQuery("body").css("background-color", "white");
        jQuery("body").css("margin", "0");

        if (!fullScreenFunction) {
            $controlsPanel.width(Math.round(320 / browserZoomLevel));
            $presentationInjectContainer.find(".controlsPanelOuterWrapper").height(Math.round(40 / browserZoomLevel));
			$presentationInjectContainer.find(".controlsPanelOuterWrapper").css("bottom", Math.round(20 / browserZoomLevel) + "px");
            var buttons = $controlsPanel.find('.controlButton');
            var buttonSize = Math.round(30 / browserZoomLevel);
            buttons.width(buttonSize);
            buttons.height(buttonSize);
            buttons.css("margin", Math.floor(5 / browserZoomLevel) + 'px ' + Math.floor(10 / browserZoomLevel) + 'px');
            buttons.css("background-size", buttonSize + "px");
        }

        if (autoRotationInProgress) {
            stopAutoRotation();
        }

        scalePresentationToMinZoomLevel();

        centerLayerAfterZoom();

        setPreviousLayerValues();
		that.unblockAllUserInteractions();

    };

    var adjustPresentationToNormalScreen = function() {
		
		if( isAndroid ){
			document.querySelector('meta[name="viewport"]').content ="width=device-width";
		}
		
		var $allPresentationsInjectContainers = jQuery(".presentationContainer-market360");
		var $allControlPanels = jQuery(".controlsPanel");
		
        $controlsPanel.removeClass("fullscreen");
        that.$activeLayer.find("*").remove();
        previousZoomIndex = that.zoomLevelIndex;

        if (zoomEnabled === ZOOM_ENABLED) {
            $zoomOutButton.addClass("buttonDisabled");
            $zoomInButton.removeClass("buttonDisabled");
        }

        $rotateButton.removeClass('buttonDisabled');
        $fullscreenButton.removeClass('fullscreen');

        $presentationInjectContainer.height(normalHeight);
        $presentationInjectContainer.width(normalWidth);

        manualRotationStep = parseInt((normalWidth / framesCount) * manualRotationInterval);

        // all elements should be visible as before entering fullscreen
//        $("body").find("*").css("visibility", "");
        jQuery("body").css("overflow", "");
		
//        $allPresentationsInjectContainers.css("visibility", "");
//        $allPresentationsInjectContainers.find("*").css("visibility", "");

		$presentationInjectContainer.css("z-index", "");
        $rotationLayer.find("img").css("visibility", "hidden");
        $rotationLayer.find(".imageContainerId-" + that.currentImageIndex).css("visibility",
            "visible");

        jQuery("#cookiesInfoWrapper").css("display", cookiesInfoWrapperDisplay);

        $allPresentationsInjectContainers.css("position", "");
        $allPresentationsInjectContainers.css("left", "");
        $allPresentationsInjectContainers.css("top", "");
        $allPresentationsInjectContainers.css("background-color", "");

        jQuery("html").css("position", "");
        jQuery("html").css("left", "");
        jQuery("html").css("top", "");
        jQuery("body").css("background-color", "");
        jQuery("body").css("margin", "");

        if (!fullScreenFunction) {
            $controlsPanel.width(320);
            $presentationInjectContainer.find(".controlsPanelOuterWrapper").height(40);
            $presentationInjectContainer.find(".controlsPanelOuterWrapper").css("bottom", "20px");
            var buttons = $controlsPanel.find('.controlButton');
            buttons.width(30);
            buttons.height(30);
            buttons.css("margin", '0 10px');
            buttons.css('background-size', '30px');
        }

        if (autoRotationInProgress) {
            stopAutoRotation();
        }

        scalePresentationToMinZoomLevel();

        centerLayerAfterZoom();

        setPreviousLayerValues();

		$allControlPanels.css('visibility', 'visible');
        $allControlPanels.css("bottom", "");
		that.unblockAllUserInteractions();

    };

    function setPreviousLayerValues() {
        previousLayerLeft = $rotationLayer.position().left;
        previousLayerTop = $rotationLayer.position().top;
        previousLayerLeftMargin = parseInt($rotationLayer.css("margin-left"));
        previousLayerTopMargin = parseInt($rotationLayer.css("margin-top"));
        previousLayerWidth = $rotationLayer.width();
        previousLayerHeight = $rotationLayer.height();
    }

    function resetPresentationMargins(left, zooming) {

        if (left === true) {
            jQuery(".zoomLayer").css("margin-left", "0px");
            newMarginLeft = 0;
            if (!zooming) {
                $rotationLayer.css("margin-left", "0px");
            }

        } else if (left === false) {
            jQuery(".zoomLayer").css("margin-top", "0px");
            newMarginTop = 0;
            if (!zooming) {
                $rotationLayer.css("margin-top", "0px");
            }
        } else {
            jQuery(".zoomLayer").css("margin-left", "0px");
            jQuery(".zoomLayer").css("margin-top", "0px");
            newMarginLeft = 0;
            newMarginTop = 0;
            if (!zooming) {
                $rotationLayer.css("margin-left", "0px");
                $rotationLayer.css("margin-top", "0px");
            }

        }

    }

    function setPresentationMargins(zooming) {
        // center vertically zoom layer
        if (newHeight <= $outerWrapper.height()) {
            newMarginTop = ($outerWrapper.height() - newHeight) / 2;
            if (!zooming) {
                that.$activeLayer.css("margin-top", newMarginTop + "px");
                $rotationLayer.css("margin-top", newMarginTop + "px");
            }
        }

        if (newWidth <= $outerWrapper.width()) {
            newMarginLeft = ($outerWrapper.width() - newWidth) / 2;
            if (!zooming) {
                that.$activeLayer.css("margin-left", newMarginLeft + "px");
                $rotationLayer.css("margin-left", newMarginLeft + "px");
            }
        }
    }

    var toggleFullScreen = function() {
		
		if( blockAllUserInteractions ){
			return;
		}
		
        if (!isFullScreenActive()) {
            // Supports most browsers and their versions.
//            var el = document.documentElement;
            if (fullScreenFunction) {
                fullScreenFunction.call( $presentationInjectContainer[0] );
            } else {
                fullscreenActive = true;
                adjustPresentationToFullScreen();
            }

        } else {
            var requestMethod = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (requestMethod) { // Native full screen.
                requestMethod.call(document);
            } else {
                fullscreenActive = false;
                adjustPresentationToNormalScreen();
            }
        }
    };

    var isFullScreenActive = function() {
        if (!document.mozFullScreen && !document.webkitIsFullScreen && !fullscreenActive && !document.msFullscreenElement) {
            return false;
        } else {
            return true;
        }
    };

    var downloadImages = function(levelIndex) {
        imagesToLoad = getImagesForLevel(levelIndex);
        resMan.clearDownloadQueue();
        for (var i = 0; i < imagesToLoad.length; i++) {
            resMan.queueDownload(imagesToLoad[i]);
        }

        resMan.downloadAll(function() {
            setImagesSrc();
        });
    };

    // load only images that are visible in presentation window
    var getImagesForLevel = function(levelIndex) {
        // tile name:
        // tile_036_001_001_001 -
        // tile_frameNumber_indexFromZoomLevelsArrayStartingFrom1_yCoordinate_xCoordinate
        var imgPathsArray = [];
        var xCoord, yCoord;
        var imgNo, lvl, path;
        if (visibleImagesNumbers.length > 0) {
            for (var i = 0; i < visibleImagesNumbers.length; i++) {
                yCoord = Math.ceil(visibleImagesNumbers[i] / zoomArray[levelIndex]);
                xCoord = visibleImagesNumbers[i] % zoomArray[levelIndex];
                if (xCoord === 0) {
                    xCoord = zoomArray[levelIndex];
                }

                imgNo = (that.currentImageIndex + 1) < 10 ? "00" + (that.currentImageIndex + 1) : "0" + (that.currentImageIndex + 1);
                //lvl = (levelIndex + 1) < 10 ? "00" + (levelIndex + 1) : "0" + (levelIndex + 1);
                lvl = zoomNames[levelIndex];
                yCoord = yCoord < 10 ? "00" + yCoord : "0" + yCoord;
                xCoord = xCoord < 10 ? "00" + xCoord : "0" + xCoord;
                path = main.configPath + "tiles/" + 'tile_' + imgNo + '_' + lvl + '_' + yCoord + '_' + xCoord + '.jpg';
                imgPathsArray.push(path);

            }
        }

        return imgPathsArray;
    };

    function loadParameters() {
        // load original parameters first
        manualRotationSlowParam = that.config.manualRotationSlowParam;
        autoRotationDelay = that.config.autoRotationDelay;
		autoRotationDirection = that.config.autoRotationDirection;
        framesCount = that.config.framesCount;
        zoomArray = that.config.zoomLevels;
        zoomNames = that.config.zoomNames;
        tilesDimensions = that.config.tilesDimensions;
        tileMargin = that.config.tileMargin;
		keyFrames = that.config.keyFrames;
		slowRotationFps = that.config.slowRotationFps;
		fastRotationFps = that.config.fastRotationFps;
		initialRotationFps = that.config.initialRotationFps;

        if (typeof tileMargin === "undefined") {
            tileMargin = 0;
        }
		
		if (typeof keyFrames === "undefined") {
			keyFrames = [];
		}

        // load user's specific parameters
        startImageNumber = that.userConfig.startImageNumber;
        autoRotationFps = that.userConfig.autoRotationFps;
        autoRotationMode = that.userConfig.autoRotationMode;
        maxZoomLevel = that.userConfig.maxZoomLevel;
        fullscreenEnabled = that.userConfig.fullscreenEnabled;
        zoomEnabled = that.userConfig.zoomEnabled;

        // validate user's parameters
        validateUserConfig();
    };

    function validateUserConfig() {
        if (startImageNumber === undefined || startImageNumber < 0 || startImageNumber > (framesCount - 1)) {
            main.warn("startImageNumber loaded from base config");
            startImageNumber = that.config.startImageNumber;
        }

        if (autoRotationFps === undefined || autoRotationFps < 1) {
            main.warn("autoRotationFps loaded from base config");
            autoRotationFps = that.config.autoRotationFps;
        }

        if ( autoRotationMode === undefined || (autoRotationMode !== NORMAL_MODE && autoRotationMode !== PING_PONG_MODE )) {
            main.warn("autoRotationMode loaded from base config");
            autoRotationMode = that.config.autoRotationMode;
        }

        if (maxZoomLevel === undefined || maxZoomLevel < 0 || maxZoomLevel > that.config.maxZoomLevel) {
            main.warn("maxZoomLevel loaded from base config");
            maxZoomLevel = that.config.maxZoomLevel;
        }

        zoomArray.splice(maxZoomLevel);
        lastAvailableZoomLevelIndex = zoomArray.length - 1;

        if (fullscreenEnabled === undefined || (fullscreenEnabled !== 0 && fullscreenEnabled !== 1)) {
            main.warn("fullscreenEnabled loaded from base config");
            fullscreenEnabled = that.config.fullscreenEnabled;
        }

        if (zoomEnabled === undefined || (zoomEnabled !== 0 && zoomEnabled !== 1)) {
            main.warn("zoomEnabled loaded from base config");
            zoomEnabled = that.config.zoomEnabled;
        }

    };

    this.setAutoRotationFps = function(value) {
        autoRotationFps = value;
    };

    this.getAutoRotationFps = function() {
        return autoRotationFps;
    };

    this.setStartImageNumber = function(value) {
        startImageNumber = value;
    };

    this.getStartImageNumber = function() {
        return startImageNumber;
    };

    this.setAutoRotationDirection = function(value) {
        autoRotationDirection = value;
    };

    this.getAutoRotationDirection = function() {
        return autoRotationDirection;
    };

    this.setAutoRotationMode = function(value) {
        autoRotationMode = value;
    };

    this.getAutoRotationMode = function() {
        return autoRotationMode;
    };

    this.setMaxZoomLevel = function(value) {
        maxZoomLevel = value;
    };

    this.getMaxZoomLevel = function() {
        return maxZoomLevel;
    };

    this.setFullscreenEnabled = function(value) {
        fullscreenEnabled = value;
    };

    this.getFullscreenEnabled = function() {
        return fullscreenEnabled;
    };

    this.setZoomEnabled = function(value) {
        zoomEnabled = value;
    };

    this.getZoomEnabled = function() {
        return zoomEnabled;
    };

    return this;
};