var presentationLib = presentationLib || {};
presentationLib.queue = presentationLib.queue || [];

presentationLib.Main = function() {
    var that = this;
    that.ResManager;
    that.Presentation;
    var enableLogs = false;

    this.$container;

    this.width;
    this.height;

    this.engineFolder = "skel/engine/";
    this.configPath = "presentations/";

    this.fullPercentage = false;
	this.allFilesLoaded = false;

    this.init = function() {
        that.ResManager = presentationLib.ResManager(that);
        that.Presentation = new presentationLib.Presentation(that);
        that.Presentation.initPresentation();
		
		//remove first element and load next if any
		presentationLib.queue.shift();
		if( presentationLib.queue.length > 0 ){
			that.loadPresentationFiles( presentationLib.queue[0] );
		}
    };

    this.setPresentationPaths = function(engineFolder, configPath) {
        that.engineFolder = engineFolder;
        that.configPath = configPath;
    };

    this.filesLoadedNumber = 0;
    this.scriptsSrc;
    var filesToLoad;
    this.injectPresentation = function(presentationContainerId, width, height) {

        that.$container = jQuery("#" + presentationContainerId);
        that.$container.addClass("presentationContainer-market360");
        // minimum size of the presentation is 350x230.
        width = width < 350 ? 350 : width;
        height = height < 230 ? 230 : height;

        that.$container.width(width);
        that.$container.height(height);
        that.width = width;
        that.height = height;

        var presentationContent = "<div class=\"mainPresentationContaier\">" + "<div id=\"loadingMask\"></div>" + "<div class=\"outerWrapper\" style=\"position:relative;\">" + "<div class=\"loadingDiv\">" + "<div style=\"left: " + (width / 2 - 68) + "px; top: " + (height / 2 - 34) + "px\"></div>" + "<span class=\"percentCounter\" style=\"position:absolute; text-align:center; width:66px; display:block; height:29px; font-size:28px; left: " + (width / 2 + 2) + "px; top: " + (height / 2 - 14) + "px\">0%</span>" + "</div>" + "<div class=\"rotationLayer\"></div>" + "</div>" + "<div class=\"controlsPanelOuterWrapper\" ><div class=\"controlsPanel\" ><div class=\"controlsPanelInnerWrapper\">" + "<div class=\"leftButton controlButton\"></div>" + "<div class=\"rightButton controlButton\"></div>" + "<div class=\"rotateButton controlButton pause\"></div>" + "<div class=\"zoomInButton controlButton\"></div>" + "<div class=\"zoomOutButton controlButton\"></div>" + "<div class=\"fullscreenButton controlButton\"></div></div></div>";

        that.$container.html(presentationContent);
        $percentCounter = that.$container.find('.percentCounter');

        that.scriptsSrc = [that.engineFolder + "lib/modernizr.custom.js",
            that.engineFolder + "js/Main.js",
            that.engineFolder + "js/ResManager.js",
            that.engineFolder + "js/Presentation.js",
            that.configPath + "Config.js?date=" + Date.now(),
            that.configPath + "UserConfig.js?date=" + Date.now()
        ];

        filesToLoad = that.scriptsSrc.length + 1; // all js scripts + css link
		
		that.addToQueue( that );

    };
	
	this.loadPresentationFiles = function( presentationContext ){
		var $head = jQuery(document.getElementsByTagName('head'));
		for (var i = 0; i < presentationContext.scriptsSrc.length; i++) {
            presentationContext.addScript($head, presentationContext.scriptsSrc[i]);
        }
        presentationContext.addCss($head, presentationContext.engineFolder + "view/style.css");
        presentationContext.increseLoadCounter();
	};
	
	this.addToQueue = function( presentationContext ){
		presentationLib.queue = presentationLib.queue || [];
		presentationLib.queue.push( presentationContext );
		if( presentationLib.queue.length === 1 ){
			//only one presentation files to load
			that.loadPresentationFiles( presentationLib.queue[0] );
		}   
	};

    this.percentCounter = 0;
    var $percentCounter;

    this.increseLoadCounter = function() {
    	$percentCounter.show();
        setTimeout(function() {
            ++that.percentCounter;
            if (that.percentCounter > 30 && !that.nextLoadStep){
            	that.percentCounter = 30;
            }else{
            	if (that.percentCounter < 30 && that.nextLoadStep)
            	{
            		that.percentCounter = 30;
            	}
            }
            $percentCounter.text(that.percentCounter + "%");
            if (that.percentCounter < 100){
                that.increseLoadCounter();
			}else{
                that.fullPercentage = true;
			}
        }, 15);
    };

    this.addScript = function($head, src) {
        var s = document.createElement('script');

        s.addEventListener("load", function() {
            that.filesLoadedNumber++;
            if (that.filesLoadedNumber === filesToLoad) {
                // all files have been loaded. Proceed
				that.allFilesLoaded = true;
                that.init();
            }
        });

        s.setAttribute('src', src);
        s.setAttribute('type', "text/javascript");
        $head[0].appendChild(s);
    };

    this.addCss = function($head, src) {
        var link = document.createElement('link');
        link.setAttribute('href', src);
        link.setAttribute('rel', "stylesheet");
        link.setAttribute('type', "text/css");
        $head[0].appendChild(link);

        that.isCssLoaded(link, function() {
            that.filesLoadedNumber++;
            if (that.filesLoadedNumber === filesToLoad) {
                // all files have been loaded. Proceed
				that.allFilesLoaded = true;
                that.init();
            }
        });
    };

    var safeCounter = 30;
    this.isCssLoaded = function(link, callback) {
        safeCounter--;

        if (safeCounter === 0) {
            that.warn("Unable to load css file");
        }

        if (that.$container.find(".rotationLayer:first").css("position") === "absolute") {
            // css has been loaded
            callback();
        } else {
            setTimeout(function() {
                that.isCssLoaded(link, callback);
            }, 100);
        }
    };

    this.log = function(text) {
        if (enableLogs) {
            console.log(text);
        }
    };

    this.warn = function(text) {
        if (enableLogs) {
            console.warn(text);
        }
    };

    return this;
};