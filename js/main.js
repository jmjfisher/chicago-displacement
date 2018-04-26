//function to instantiate the Leaflet map
function createMap(){
    
    //sets map boundary - needs tweaking
    var myBounds = [[41, -89.7],[43.9, -86.7]];
    
    //create the map
    var map = L.map('mapid', {
        maxZoom: 18,
        minZoom: 10,
        maxBounds: myBounds,
        zoomControl:true
    }).setView([41.88, -87.7], 12);
   
    var streets = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'mapbox.streets',
        accessToken: 'pk.eyJ1Ijoiam1qZmlzaGVyIiwiYSI6ImNqYXVlNDg3cDVhNmoyd21oZ296ZXpwdWMifQ.OGprR1AOquImP-bemM-f2g'
    }).addTo(map);
    
    var imagery = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'mapbox.streets-satellite',
        accessToken: 'pk.eyJ1Ijoiam1qZmlzaGVyIiwiYSI6ImNqYXVlNDg3cDVhNmoyd21oZ296ZXpwdWMifQ.OGprR1AOquImP-bemM-f2g'
    });
    
    var baseMaps = {
        "Streets": streets,
        "Imagery": imagery
    }; 
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.json, "data/cook_county_idx.topojson") //async load tracts
        .defer(d3.json, "data/CTA_4326.topojson") //async load L lines
        .defer(d3.json, "data/CTA_stations_4326.topojson") //async L stations
        .defer(d3.json, "data/new_build_500k.topojson") //asyn load new buildings
        .defer(d3.json, "data/one_mi_buffer.topojson") //asyn load 1 mile buffer
        .await(callback);
        
    function callback (error, tractsTopo, linesTopo, stationsTopo, buildingsTopo, bufferTopo, csvMaster) {
        
        //grab the features from the topojsons
        var tracts = topojson.feature(tractsTopo, tractsTopo.objects.cook_county_idx).features;
        var lines = topojson.feature(linesTopo, linesTopo.objects.CTA_4326).features;
        var stations = topojson.feature(stationsTopo, stationsTopo.objects.CTA_stations_4326).features;
        var buildings = topojson.feature(buildingsTopo, buildingsTopo.objects.new_build_500k).features;
        var buffer = topojson.feature(bufferTopo, bufferTopo.objects.one_mi_buffer).features;
        
        //call function to add tracts information to add-able layers
        var tractInformation = addTracts(map, tracts);
        var tractLayers = tractInformation[0];
        var tractScales = tractInformation[1];
        
        //add blank tracts to begin...
        tractLayers["None"].addTo(map);
        
        //call function to get CTA and building stuff on map
        var linesStationsBuildings = addOtherLayers(map, lines, stations, buildings, buffer);
        
        var groupedOverlays = {
          "Tract Data Overlays": tractLayers,
          "Reference Layers": linesStationsBuildings
        };
        
        //set options for groupedLayers control
        var options = {
            exclusiveGroups: ["Tract Data Overlays"],
            //collapsed: false
        }
        
        L.control.groupedLayers(baseMaps, groupedOverlays, options).addTo(map);
        
        //zoom settings
        var searchControl = new L.Control.Search(
            {layer: tractLayers['None'],
             initial: false,
             propertyName: "GEOID",
             zoom: 13,
             tooltipLimit: 7,
             textPlaceholder: "Search Tract ID to zoom",
             textErr: "Tract does not exist",
             hideMarkerOnCollapse: true,
             autoCollapse: true
            });
        
        //add zoom search to map
        map.addControl(searchControl);
        
        //on zoom to, open tract popup
        searchControl.on('search:locationfound', function (e){
            e.layer.openPopup();
        })
        
        //change legend on tract change
        map.on('overlayadd', function(layer){
            //on layer change, alter search layer in search
            var MTA = ['CTA "L" Routes','CTA "L" Stations','CTA Stations 1-Mile Buffer','New Buildings Since 2010']
            var expressed = layer.name;

            if (MTA.includes(expressed) == false){
                searchControl.setLayer(tractLayers[layer.name])
            }
            
            //on layer change, update the legend
            changeLegend(layer, tractScales, map);
        })
    };
    
    var sidebar = L.control.sidebar('sidebar', {
        position: 'left'
    });

    map.addControl(sidebar);
    sidebar.show();
    sidebar.setContent('<h4 class="sidebar-title">Displacement and Gentrification Indicator Map</h4><br><p>This map allows you to visualize economic, education, housing, and population indicators that may help in the identification of areas of gentrification and/or displacement in Cook County, IL.</p><br><p>Hover your mouse over the <b>layers button</b> in the top right corner of the map to display and toggle between the available basemaps, census tract choropleth overlays, and reference layers. You may also zoom and center the map to a tract by searching its ID and click on any tract to retrieve more information about it, depending on the current tract overlay.</p><br><p>Scroll down to view a corresponding dynamic parallel coordinates <a class="js-scroll" href="#dataarea">visualization</a> or to learn more <a class= "js-scroll" href="#about">about</a> the data and developers.</p>');
    
    //http://labs.easyblog.it/maps/leaflet-search/
    
    $(".leaflet-control-container").on('mousedown dblclick pointerdown wheel', function(ev){
        L.DomEvent.stopPropagation(ev);
    });
    
    //call function to create the chart if not too small
    var browserWidth = $(document).width();
    if (browserWidth > 760){
        createChart();
    } else {
        smallBrowser();
    };
    
}; // end of createMap

// source:http://leafletjs.com/examples/choropleth/
function changeLegend(layer,tractScales,map){
    //lol, MTA is NYC
    var MTA = ['CTA "L" Routes','CTA "L" Stations','CTA Stations 1-Mile Buffer','New Buildings Since 2010']
    var expressed = layer.name;
    
    //if adding MTA layer, don't mess with legend - the rest is housed in this IF statement
    if (MTA.includes(expressed) == false & expressed != 'Gentrification Index' & expressed != 'None'){
        
        //get rid of previous legend
        var oldLegend = $('.legend');
        if (oldLegend !== null){
            oldLegend.remove();
        }
        
        //set up (new) legend
        var domain = (tractScales[expressed].domain())
        var max = Math.max.apply(null, domain);
        var min = Math.min.apply(null, domain);
        var colors = tractScales[expressed].range();
        var quantiles = tractScales[expressed].quantiles();
        quantiles.unshift(min);
        quantiles.push(max);

        var legend = L.control({position: 'bottomleft'});

        legend.onAdd = function(map){

            var div = L.DomUtil.create('div', 'info legend')
            var labels = [];

            div.innerHTML += '<p><b>' + expressed + '</b></p>'

            // loop through our density intervals and generate a label with a colored square for each interval
            for (var i = 0; i < quantiles.length-1; i++) {
                div.innerHTML +=
                    '<i style="background:' + colors[i] + '"></i> ' +
                    quantiles[i].toFixed(0) + '%' + (String(quantiles[i + 1]) ? ' <b>-</b> ' + quantiles[i + 1].toFixed(0) + '%<br>' : '% +');
            };
            return div;
        };
        legend.addTo(map);
    } else if (MTA.includes(expressed) == false & expressed == 'Gentrification Index') {
        //get rid of previous legend
        var oldLegend = $('.legend');
        if (oldLegend !== null){
            oldLegend.remove();
        }
        
        //set up (new) legend
        var domain = (tractScales[expressed].domain())
        var max = Math.max.apply(null, domain);
        var min = Math.min.apply(null, domain);
        var colors = tractScales[expressed].range();
        var quantiles = tractScales[expressed].quantiles();
        quantiles.unshift(min);
        quantiles.push(max);

        var legend = L.control({position: 'bottomleft'});

        legend.onAdd = function(map){

            var div = L.DomUtil.create('div', 'info legend')
            var labels = [];

            div.innerHTML += '<p><b>' + expressed + '</b></p>'

            // loop through our density intervals and generate a label with a colored square for each interval
            for (var i = 0; i < quantiles.length-1; i++) {
                div.innerHTML +=
                    '<i style="background:' + colors[i] + '"></i> ' +
                    quantiles[i].toFixed(3) + (String(quantiles[i + 1]) ? ' <b>-</b> ' + quantiles[i + 1].toFixed(3) + '<br>' : ' +');
            };
            return div;
        };
        legend.addTo(map);
    } else if (MTA.includes(expressed) == false & expressed == 'None'){
        //get rid of previous legend
        var oldLegend = $('.legend');
        if (oldLegend !== null){
            oldLegend.remove();
        }
    }
}; // end of changeLegend

function addOtherLayers(map,lines,stations,buildings,buffer){
    
    var layerDict = {
        'New Buildings Since 2010': null,
        'CTA "L" Routes': null,
        'CTA "L" Stations': null,
        'CTA Stations 1-Mile Buffer': null
    };
    
    var routes = L.geoJSON(lines,{
        style: function(feature){return routeStyle(feature)}
    }).addTo(map);
    
    var stationMarkerOptions = {
        radius: 4,
        fillColor: "white",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };
    
    var stationPoints = L.geoJSON(stations, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, stationMarkerOptions);
        },
        onEachFeature: stationName
    }).addTo(map);
    
    var buildingMarkerOptions = {
        radius: 2,
        fillColor: "purple",
        color: 'purple',
        weight: .5,
        opacity: .9,
        fillOpacity: .8
    };
    
    var buildingPoints = L.geoJSON(buildings, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, buildingMarkerOptions);
        },
        onEachFeature: buildingInfo
    });
    
    var bufferOptions = {
        fillColor: "#2F4F4F",
        dashArray: "5, 5",
        color: "#000",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.15
    };
    
    var bufferPoly = L.geoJSON(buffer,{
        style: bufferOptions});
    
    layerDict['CTA "L" Routes'] = routes;
    layerDict['CTA "L" Stations'] = stationPoints;
    layerDict['CTA Stations 1-Mile Buffer'] = bufferPoly;
    layerDict['New Buildings Since 2010'] = buildingPoints
    
    return layerDict;
}; // end of  addOtherLayers;

function buildingInfo(feature,layer){
    
    var year = '<b>Year</b>: ' + String(feature.properties['ISSUE_DATE']).slice(0,4);
    var cost = '<b>Cost</b>: $' + feature.properties['EST_COST'].toLocaleString('en');
    var address = '<b>Address</b>: ' + String(feature.properties['STREET_NUM']) + ' ' + String(feature.properties['STREET_DIR']) + ' ' + String(feature.properties['STREET_NAM']) + ' ' + String(feature.properties['SUFFIX']);
    var permit = '<b>Permit #</b>: ' + String(feature.properties['PERMIT_NO']);
    
    var popupContent = year + '<br>' + cost + '<br>' + address + '<br>' + permit;
    
    layer.bindTooltip(popupContent, {
        offset: [0,-7],
        direction: 'top',
        className: 'popupBuilding'});
} // end of buildingInfo

function stationName(feature,layer){
    
    var popupContent = feature.properties['LONGNAME'];
    
    layer.bindTooltip(popupContent, {
        offset: [0,-7],
        direction: 'top',
        className: 'popupStation'});
} // end of  stationNAME

function routeStyle(feature){
    
    var routeColor = feature.properties['LEGEND'];
    
    if (routeColor === 'RD'){
        var color = 'red' 
    }else if(routeColor ==='BL'){
        var color = 'blue'
    }else if(routeColor ==='BR'){
        var color = 'brown'
    }else if(routeColor ==='GR'){
        var color = 'green'
    }else if(routeColor ==='ML'){
        var color = 'black'
    }else if(routeColor ==='OR'){
        var color = 'orange'
    }else if(routeColor ==='PK'){
        var color = 'pink'
    }else if(routeColor ==='PR'){
        var color = 'purple'
    }else{
        var color = 'yellow'
    };
    
    //define style
    var myStyle = {
        "color": color,
        "weight": 3,
        "opacity": .8
    };
    return myStyle;
}; // end of  routeStyle

function addTracts(map, tracts) { //source: http://bl.ocks.org/Caged/5779481
    
    var options = ['GENT_IDX','UERPCTCHG','PCIPCTCHG','POVPCTCHG','POPPCTCHG','BLKPCTCHG',
                   'ASNPCTCHG','HSPPCTCHG','WHTPCTCHG','HSPCTCHG','PHSPCTCHG','ORRPCTCHG','NONE'];
    
    var dictKeys = ['Gentrification Index',
                    'Unemployment Rate Growth',
                   'Per Capita Income Growth',
                   'Poverty Rate Growth',
                   'Population Growth',
                   'Black Pop Growth',
                   'Asian Pop Growth',
                   'Hispanic Pop Growth',
                   'White Pop Growth',
                   'High School or Less Growth',
                   'At least Some College Growth',
                   'Renter:Owner Ratio Growth',
                   'None']
    
    var altDitc = {};
    var scaleDict = {};
    var geojson;
    
    function highlightFeature(e) {
        var layer = e.target;

        layer.setStyle({
            "weight": 4,
            "opacity": 0.8,
            "color": 'aqua'
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
    };

    function resetHighlight(e) {
        var layer = e.target;

        layer.setStyle({
        "weight": 0,
        "opacity": 0.5,
        "color": '#3a3a3a'
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
    };
    
    function onEachFeature(feature,layer,expressed) {

        if (expressed === 'UERPCTCHG'){
            var lookUp = ['UERPCTCHG','2016_POP','2010_POP']
            var fields = ['Unemployment Rate Growth (% Difference): ','2016 Population: ','2010 Population: ']
        } else if (expressed === 'PCIPCTCHG'){
            var lookUp = ['PCIPCTCHG','2016_POP','2010_POP']
            var fields = ['Per Capita Income Growth (%): ','2016 Population: ','2010 Population: ']
        } else if (expressed === 'POVPCTCHG'){
            var lookUp = ['POVPCTCHG','2016_POP','2010_POP']
            var fields = ['Poverty Rate Growth (% Difference): ','2016 Population: ','2010 Population: ']
        } else if (expressed === 'POPPCTCHG'){
            var lookUp = ['POPPCTCHG','2016_POP','2010_POP']
            var fields = ['Population Growth (%): ','2016 Population: ','2010 Population: ']
        } else if (expressed === 'BLKPCTCHG'){
            var lookUp = ['BLKPCTCHG','2016_BLACK','2010_BLACK']
            var fields = ['Black Pop Growth (%): ','2016 Black Pop: ','2010 Black Pop: ']
        } else if (expressed === 'ASNPCTCHG'){
            var lookUp = ['ASNPCTCHG','2016_ASIAN','2010_ASIAN']
            var fields = ['Asian Pop Growth (%): ','2016 Asian Pop: ','2010 Asian Pop: ']
        } else if (expressed === 'HSPPCTCHG'){
            var lookUp = ['HSPPCTCHG','2016_HISP','2010_HISP']
            var fields = ['Hispanic Pop Growth (%): ','2016 Hispanic Pop: ','2010 Hispanic Pop: ']
        } else if (expressed === 'WHTPCTCHG'){
            var lookUp = ['WHTPCTCHG','2016_WHITE','2010_WHITE']
            var fields = ['White Pop Growth (%): ','2016 White Pop: ','2010 White Pop: ']
        } else if (expressed === 'HSPCTCHG'){
            var lookUp = ['HSPCTCHG','2016_HS','2010_HS']
            var fields = ['High School or Less Growth (% Difference): ','2016 High School or Less Pop: ','2010 High School or Less Pop: ']
        } else if (expressed === 'PHSPCTCHG'){
            var lookUp = ['PHSPCTCHG','2016_POSTH','2010_POSTH']
            var fields = ['At least Some College Growth (% Difference): ','2016 At Least Some College Pop: ','2010 At Least Some College Pop: ']
        } else if (expressed === 'ORRPCTCHG'){
            var lookUp = ['ORRPCTCHG','2016_OWNER','2010_OWNER','2016_RENT','2010_RENT']
            var fields = ['Renter:Owner Ratio Growth (%): ','2016 Home Owner Pop: ','2010 Home Owner Pop: ','2016 Home Renter Pop: ','2010 Home Renter Pop: ']
        } else if (expressed === 'GENT_IDX'){
            var lookUp = ['GENT_IDX','2016_POP','2010_POP']
            var fields = ['Gentrification Index: ','2016 Population: ','2010 Population: ']
        } else if (expressed === 'NONE'){
            var lookUp = ['2016_POP','2010_POP']
            var fields = ['2016 Population: ','2010 Population: ']
        }

        var popupContent = '';
        lookUp.unshift('GEOID');
        fields.unshift('Tract: ');

        for (var i=0; i < lookUp.length; i++){
            var stat = String(feature.properties[lookUp[i]]);
            popupContent += '<b>'+fields[i]+'</b>';
            popupContent += stat + '<br>';
        }

        layer.bindPopup(popupContent, {
            minWidth: 50,
            closeOnClick: true,
            className: 'popup'});
        
        if (expressed !== 'NONE'){
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight
            });
        };
    }; // end of onEachFeature
    
    for (var i = 0; i < options.length; i++){
        var expressed = options[i];
        var dictKey = dictKeys[i];
        var colorScale = makeColorScale(expressed,tracts);
        geojson = L.geoJson(tracts, {
            style: function(feature){
                if (expressed != 'NONE'){
                    return setStyle(feature, colorScale, expressed)
                } else {
                    var myStyle = {
                        "fillColor": '#3a3a3a',
                        "fillOpacity": 0,
                        "weight": 0,
                        "opacity": 0,
                        "color": '#3a3a3a',
                        "className": String(feature.properties['CG_GEOID'])
                    };
                    return myStyle;
                }
            },
            onEachFeature: function(feature,layer){return onEachFeature (feature,layer,expressed)}
            //http://leafletjs.com/examples/choropleth/
        })
        altDitc[dictKey] = geojson;
        scaleDict[dictKey] = colorScale;
    }
    return [altDitc, scaleDict];
}; // end of addTracts

function setStyle(feature, colorscale, expressed){
    //find the feature's fill color based on scale and make sure it's not undefined
    var check = feature.properties[expressed];
    if (check == 'UNDEF'){
        var fillColor = "#CCC"
    }else{
        var fillColor = colorscale(feature.properties[expressed]);
    }
    //define style
    var myStyle = {
        "fillColor": fillColor,
        "fillOpacity": 0.5,
        "weight": 0,
        "opacity": 0.5,
        "color": '#3a3a3a',
        "className": String(feature.properties['CG_GEOID'])
    };
    return myStyle;
}; // end of  setStyle

function makeColorScale(expressed,tracts){
    
    var twoGreenThreeRed = ['UERPCTCHG','POVPCTCHG','ORRPCTCHG'];
    var threeGreenTwoRed = ['HSPCTCHG'];
    var twoRedThreeGreen = ['PCIPCTCHG','POPPCTCHG','BLKPCTCHG','ASNPCTCHG','HSPPCTCHG'];
    var threeRedTwoGreen = ['WHTPCTCHG'];
    var oneRedFourGreen = ['ORRPCTCHG'];
    
    if (twoGreenThreeRed.includes(expressed)){
        var colorClasses = ['#74c476','#bae4b3','#fd8d3c','#f03b20','#bd0026'];
    } else if (threeGreenTwoRed.includes(expressed)) {
        var colorClasses = ['#74c476','#bae4b3','#edf8e9','#fd8d3c','#f03b20'];
    } else if (twoRedThreeGreen.includes(expressed)) {
        var colorClasses = ['#fd8d3c','#fecc5c','#74c476','#31a354','#006d2c'];
    } else if (threeRedTwoGreen.includes(expressed)) {
        var colorClasses = ['#f03b20','#fd8d3c','#fecc5c','#74c476','#31a354'];
    } else if (expressed === 'GENT_IDX'){
        var colorClasses = ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'];
    } else {
        var colorClasses = ['#fd8d3c','#bae4b3','#74c476','#31a354','#006d2c'];
    };

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<tracts.length; i++){
        var check = tracts[i].properties[expressed];
        if (check !== 'UNDEF') {
            var val = parseFloat(check);
            domainArray.push(val);
        }
    };
    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
}; // end of  makeColorScale

//delayed scrolling between page sections
function smoothScroll(){
  // Add smooth scrolling to all links
  $(".js-scroll").on('click', function(event) {

    // Make sure this.hash has a value before overriding default behavior
    if (this.hash !== "") {
      // Prevent default anchor click behavior
      event.preventDefault();

      // Store hash
      var hash = this.hash;

      // Using jQuery's animate() method to add smooth page scroll
      // The optional number (800) specifies the number of milliseconds it takes to scroll to the specified area
      $('html, body').animate({
        scrollTop: $(hash).offset().top
      }, 700, function(){
   
        // Add hash (#) to URL when done scrolling (default click behavior)
        window.location.hash = hash;
      });
    }
  });
}; // end of smoothScroll

function scrollify(){
    $.scrollify({
        section : "#home,#maparea,#dataarea,#aboutarea",
        easing: "easeOutExpo",
        scrollSpeed: 700,
        offset : 0,
        scrollbars: true,
        standardScrollElements: "",
        setHeights: true,
        overflowScroll: true,
        updateHash: false,
        touchScroll:true,
        before:function() {},
        after:function() {},
        afterResize:function() {},
        afterRender:function() {}
    });
};

//_______________________________________________________________________________________________________________
//_______________________________________________________________________________________________________________

//createCHART 
//https://bl.ocks.org/syntagmatic/05a5b0897a48890133beb59c815bd953
function createChart(){

    var screenHeight = $(window).height(),
        parentWidth = $("#data").parent().width(),
        dataWidth = $("#data").width(),
        dataHeight = $("#data").height(),
        margin = {top: 80, right: 140, bottom: 40, left: 40},
        height = (screenHeight*.88) - margin.top - margin.bottom,
        width = (parentWidth*1) - margin.left - margin.right-150,
        innerHeight = height - 2;

    var devicePixelRatio = window.devicePixelRatio || 1;
    var lineColors = d3.scaleOrdinal()
    .range(
        [
        //"#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858" //blue
        "#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"]); //purple
    // these are assgined to the primary key and will need to be changed
    //for now they serve as a beautiful mess to the chart.
    //number acutally is a float too 
    var types = {
      "Number": {
        key: "Number",
        coerce: function(d) { return +d; },
        extent: d3.extent,
        within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
        defaultScale: d3.scaleLinear().range([innerHeight, 0])
      },
      "String": {
        key: "String",
        coerce: String,
        extent: function (data) { return data.sort(); },
        within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
        defaultScale: d3.scalePoint().range([0, innerHeight])
      },
    }; // end of var types 

    //make up the columns in the chart 
    //first column all the way to the end
    var dimensions = [
      {
        key: "GENT_IDX",
        description: "Gentrification Index",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
     {
        key: "PHSPCTCHG",
        description: "At least Some College (% Difference)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "HSPCTCHG",
        description: "High School or Less (% Difference)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "ORRPCTCHG",
        description: "Renter:Owner Ratio (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "PCIPCTCHG",
        description: "Per Capita Income (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "POVPCTCHG",
        description: "Poverty Rate (% Difference)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "UERPCTCHG",
        description: "Unemployment Rate (% Difference)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
     {
        key: "ASNPCTCHG",
        description: "Asian Pop (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "BLKPCTCHG",
        description: "Black Pop (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "HSPPCTCHG",
        description: "Hispanic Pop (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "WHTPCTCHG",
        description: "White Pop (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      },
      {
        key: "POPPCTCHG",
        description: "Population (%)",
        type: types["Number"],
        scale: d3.scaleSqrt().range([innerHeight, 0])
      }
      /*
      //only keeping this around because it shows the build of a right axis
      {
        key: "manufac_name",
        description: "Manufacturer", 
        type: types["String"],
        axis: d3.axisRight()
          .tickFormat(function(d,i) {
            if (d == null) return "(null)";
            return i % 5 == 0 ? d.slice(0,22) : "";
          })
          
      } 
      */
    ];

    var xscale = d3.scalePoint()
        .domain(d3.range(dimensions.length))
        .range([0, width]);

    var yAxis = d3.axisLeft();

    var container = d3.select("#data").append("div")
        .attr("class", "parcoords")
        .style("width", dataWidth-150 + "px")
        .style("height", dataHeight-10 + "px");

    var svg = container.append("svg")
        .attr("class", "chart-svg")
        .attr("width", dataWidth-150 + "px")
        .attr("height", dataHeight-10 + "px")
      .append("g")
        .attr("class", "chart-g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

/*
    canvas is an HTML element like the div with canvas you can 
    fill pixels the result is a practical png image. big advantage is that 
    canvas can create thousands of separate elements without significantly effecting performance
    */
    var canvas = container.append("canvas")
        .attr("class", "chart-canvas")
        .attr("width", width * devicePixelRatio)
        .attr("height", height * devicePixelRatio)
        .style("width", width + "px")
        .style("height", height + "px")
        .style("margin-top", margin.top + "px")
        .style("margin-left", margin.left + "px");
    /*
    canvas is actually a DOM element 
    */
    var ctx = canvas.node().getContext("2d");
    ctx.globalCompositeOperation = 'darken';
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1.5;
    ctx.scale(devicePixelRatio, devicePixelRatio);


    //output var for bottom chart
    // this is the first of three outputs that control the chart output
    //this loads the div

    var output= d3.select("#data").append("div")
        .attr("class", "TractIDdiv")
        .append("pre")
        .attr("class", "TractID");

    var axes = svg.selectAll(".axis")
        .data(dimensions)
        .enter().append("g")
        .attr("class", function(d) { return "axis " + d.key.replace(/ /g, "_"); })
        .attr("transform", function(d,i) { return "translate(" + xscale(i) + ")"; });
    //everything above is a csv. pre-data load so this needs to be prep. for data ingestion    

    //start of loading data and of VIZ
    d3.csv("data/master.csv", function(error, data) {
        //console.log(data)
      if (error) throw error;

      // shuffle the data!
      data = d3.shuffle(data);

      data.forEach(function(d) {
        dimensions.forEach(function(p) {
          d[p.key] = !d[p.key] ? null : p.type.coerce(d[p.key]);
        });

        // truncate long text strings to fit in data table
        for (var key in d) {
          if (d[key] && d[key].length > 35) d[key] = d[key].slice(0,36);
        }
      });

      // type/dimension default setting happens here
      dimensions.forEach(function(dim) {
        if (!("domain" in dim)) {
          // detect domain using dimension type's extent function
          dim.domain = d3_functor(dim.type.extent)(data.map(function(d) { return d[dim.key]; }));
        }
        if (!("scale" in dim)) {
          // use type's default scale for dimension
          dim.scale = dim.type.defaultScale.copy();
        }
        dim.scale.domain(dim.domain);
      });

      var render = renderQueue(draw).rate(50);

      ctx.clearRect(0,0,width,height);
      ctx.globalAlpha = d3.min([0.85/Math.pow(data.length,0.3),1]);
      render(data);

      axes.append("g")
          .each(function(d) {
            var renderAxis = "axis" in d
              ? d.axis.scale(d.scale)  // custom axis
              : yAxis.scale(d.scale);  // default axis
            d3.select(this).call(renderAxis);
          })
        .append("text")
          .attr("class", "title")
          .attr("text-anchor", "start")
          .text(function(d) { return "description" in d ? d.description : d.key; });

      // Add and store a brush for each axis.
      axes.append("g")
          .attr("class", "brush")
          .each(function(d) {
            d3.select(this).call(d.brush = d3.brushY()
              .extent([[-10,0], [10,height]])
              .on("start", brushstart)
              .on("brush", brush)
              .on("end", brush)
            )
          })
        .selectAll("rect")
          .attr("x", -8)
          .attr("width", 16);

      d3.selectAll(".axis.CG_GEOID .tick text")
        .style("fill", lineColors);
    /*
    this var controls the GEOID field we want, we can add more if we'd like
    I want to figure out for to go through a dictonary....for now this
    works. 
    */
    var col2 = data.map(function(d){
        return {GEOID: d.GEOID}
    });
    //second out put for the initial load of the chart
    //slice controls the number of output rows
   output.text(d3.csvFormat(col2.slice(0,50)));


      function project(d) {
        return dimensions.map(function(p,i) {
          // check if data element has property and contains a value
          if (
            !(p.key in d) ||
            d[p.key] === null
          ) return null;

          return [xscale(i),p.scale(d[p.key])];
        });
      }; // end of project function

      function draw(d) {
        ctx.strokeStyle = lineColors(d.CG_GEOID);
        ctx.beginPath();
        var coords = project(d);
        //console.log(coords)
        coords.forEach(function(p,i) {
          // this tricky bit avoids rendering null values as 0
          if (p === null) {
            // this bit renders horizontal lines on the previous/next
            // dimensions, so that sandwiched null values are visible
            if (i > 0) {
              var prev = coords[i-1];
              if (prev !== null) {
                ctx.moveTo(prev[0],prev[1]);
                ctx.lineTo(prev[0]+6,prev[1]);
              }
            }
            if (i < coords.length-1) {
              var next = coords[i+1];
              if (next !== null) {
                ctx.moveTo(next[0]-6,next[1]);
              }
            }
            return;
          }

          if (i == 0) {
            ctx.moveTo(p[0],p[1]);
            return;
          }

          ctx.lineTo(p[0],p[1]);
        });
        ctx.stroke();
      } // end of draw function 

      function brushstart() {
        d3.event.sourceEvent.stopPropagation();
      }

      // Handles a brush event, toggling the display of foreground lines.
      function brush() {
        render.invalidate();

        var actives = [];
        svg.selectAll(".axis .brush")
            //.on("mouseover", highlight)
            //.on("mouseout", dehighlight)
              .filter(function(d) {
                return d3.brushSelection(this);
              })
            .each(function(d) {
            actives.push({
              dimension: d,
              extent: d3.brushSelection(this)
            });
            });

        var selected = data.filter(function(d) {
          if (actives.every(function(active) {
              var dim = active.dimension;
              // test if point is within extents for each active brush
              return dim.type.within(d[dim.key], active.extent, dim);
            })) {
            return true;
          }
        });


        ctx.clearRect(0,0,width,height);
        ctx.globalAlpha = d3.min([0.85/Math.pow(selected.length,0.3),1]);
        render(selected);

        /*
        this var controls the selected column. Again, I would like to this to change on it's own through
        one function instead at two different places. 
        */
        var colOut = selected.map(function(d){
            return {GEOID: d.GEOID}
        });
        //the final out put that changes the rows for the amoutn selected
        // slice controls the number of out put rows
        output.text(d3.csvFormat(colOut.slice(0,50)));

      }
    });

    function d3_functor(v) {
      return typeof v === "function" ? v : function() { return v; };
    };
    
    var chartTitle = d3.select(".data-container").append("div")
        .attr("class", "title-div")
        .append("h4")
        .attr("class", "chart-title")
        .html("Growth of Gentrification and Displacement Indicators from 2010-2016 in Cook County, IL");
    
}; // end of createChart
//_______________________________________________________________________________________________________________

// the following cluster of functions relate to the chart 
function position(d) {
  var v = dragging[d];
  return v == null ? xScale(d) : v;
}

function transition(g) {
  return g.transition().duration(500);
}

// Returns the path for a given data point.
function path(d) {
  return line(dimensions.map(function(p) { return [position(p), yScale[p](d[p])]; }));
}

function brushstart() {
  d3.event.sourceEvent.stopPropagation();
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {
  var actives = dimensions.filter(function(p) { return !yScale[p].brush.empty(); }),
      extents = actives.map(function(p) { return yScale[p].brush.extent(); });
  foreground.style("display", function(d) {
    return actives.every(function(p, i) {
      return extents[i][0] <= d[p] && d[p] <= extents[i][1];
    }) ? null : "none";
  });
} // end of brush

function highlight(d){
    d3.selectAll("#data")
    .style("stroke", "#660000")
    .style("stroke-width","1");
};

function dehighlight(){
    d3.selectAll("#data")
    .style("stroke", null)
    .style("stroke-width",null);

};

function smallBrowser(){
    $('#data').height(100)
    d3.select('#data').append("div")
        .attr('class','small-browser')
        .html('<h4>(It looks as if your browser is too thin for this chart to function usefully. Please visit again on a tablet or computer. Thank you.)</h4>');
};

//_______________________________________________________________________________________________________________


//_______________________________________________________________________________________________________________


$(document).ready(createMap);
$(document).ready(smoothScroll);
$(document).ready(scrollify);