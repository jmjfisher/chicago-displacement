//function to instantiate the Leaflet map
function createMap(){
    
    //sets map boundary - needs tweaking
    var myBounds = [[41, -89.7],[43.9, -86.7]];
    
    //create the map
    var map = L.map('mapid', {
        maxZoom: 18,
        minZoom: 10,
        maxBounds: myBounds
    }).setView([41.9, -87.67], 13);
   
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
        //csv prep for chart
        .defer(d3.csv,  "data/master.csv") //asyn load attributes from masterCSV
        .await(callback);
        
    function callback (error, tractsTopo, linesTopo, stationsTopo, buildingsTopo, csvMaster) {
        //print console and check data 
        console.log("Census Tracts",tractsTopo) //objects>>cook_county_inx >> geometries >>> properties >>> CG_GEOID
        console.log("CTA Rail Lines",linesTopo)
        console.log("CTA Rail Stations",stationsTopo)
        console.log("buildings",buildingsTopo)
        console.log("Master CSV, primary key = CG_GEOID",csvMaster)
        
        //grab the features from the topojsons
        var tracts = topojson.feature(tractsTopo, tractsTopo.objects.cook_county_idx).features;
        var lines = topojson.feature(linesTopo, linesTopo.objects.CTA_4326).features;
        var stations = topojson.feature(stationsTopo, stationsTopo.objects.CTA_stations_4326).features;
        var buildings = topojson.feature(buildingsTopo, buildingsTopo.objects.new_build_500k).features;
        
        //call function to add tracts information to add-able layers
        var tractInformation = addTracts(map, tracts);
        var tractLayers = tractInformation[0];
        var tractScales = tractInformation[1];
        
        //call function to get MTA and building stuff on map
        var linesStationsBuildings = addOtherLayers(map, lines, stations, buildings);


        //adding csv values to the chart
        setChart(csvMaster);
        
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
        
        map.on('overlayadd', function(layer){
            changeLegend(layer, tractScales, map);
        })
    };
    
    $(".leaflet-control-container").on('mousedown dblclick pointerdown wheel', function(ev){
        L.DomEvent.stopPropagation(ev);
    });

}; // end of createMap

// source:http://leafletjs.com/examples/choropleth/
function changeLegend(layer,tractScales,map){
    var MTA = ['MTA "L" Routes','MTA "L" Stations','New Buildings Since 2010']
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

function addOtherLayers(map,lines,stations,buildings){
    
    var layerDict = {
        'MTA "L" Routes': null,
        'MTA "L" Stations': null,
        'New Buildings Since 2010': null
    };
    
    var routes = L.geoJSON(lines,{
        style: function(feature){return routeStyle(feature)}
    });
    
    var stationMarkerOptions = {
        radius: 3,
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
    });
    
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
    
    layerDict['MTA "L" Routes'] = routes;
    layerDict['MTA "L" Stations'] = stationPoints;
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
    
    for (var i = 0; i < options.length; i++){
        var expressed = options[i];
        var dictKey = dictKeys[i];
        var colorScale = makeColorScale(expressed,tracts);
        var topo = L.geoJson(tracts, {
            style: function(feature){
                if (expressed != 'NONE'){
                    return setStyle(feature, colorScale, expressed)
                } else {
                    var myStyle = {
                        "fillColor": '#3a3a3a',
                        "fillOpacity": 0,
                        "weight": 0,
                        "opacity": 0,
                        "color": '#3a3a3a'
                    };
                    return myStyle;
                }
            },
            onEachFeature: function(feature,layer){return onEachFeature (feature,layer,expressed)}
        })
        altDitc[dictKey] = topo;
        scaleDict[dictKey] = colorScale;
    }
    return [altDitc, scaleDict];
}; // end of addTracts

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
        var fields = ['Gentrification Index (0-1): ','2016 Population: ','2010 Population: ']
    } else if (expressed === 'NONE'){
        var lookUp = ['2016_POP','2010_POP']
        var fields = ['2016 Population: ','2010 Population: ']
    }

    var popupContent = '';

    for (var i=0; i < lookUp.length; i++){
        var stat = String(feature.properties[lookUp[i]]);
        popupContent += '<b>'+fields[i]+'</b>';
        popupContent += stat + '<br>';
    }

    layer.bindPopup(popupContent, {
        minWidth: 50,
        closeOnClick: true,
        className: 'popup'});
}; // end of endofFeature

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
        "weight": 1.5,
        "opacity": 0.5,
        "color": '#3a3a3a'
    };
    return myStyle;
}; // end of  setStyle

/*
function makeNaturalScale(expressed,tracts){
    
    var colorClasses = ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
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
    
    var reverseArray = ['UERPCTCHG', 'POVPCTCHG', 'HSPCTCHG', 'ORRPCTCHG']
    
    if (reverseArray.includes(expressed)){
        domainArray.reverse();
    }

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);

    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });

    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};
*/

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
    
    /*
    scales taken from colorbrewer
    greens: ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c']
    reds: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026']
    */

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
      }, 800, function(){
   
        // Add hash (#) to URL when done scrolling (default click behavior)
        window.location.hash = hash;
      });
    }
  });
}; // end of smoothScroll

//_________________________________
//Start of CHART with global variables



//margin and following default settings but will need to tweek 
//global VAR
//updated 20180416
var margin = {top: 30, right: 10, bottom: 10, left: 10},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;
//scalePoint
var xScale = d3.scaleLinear([0, width], 1),
    yScale = {},
    dragging = {};

var line = d3.line(),
    yAxis = d3.axisLeft()
        .scale(yScale),
    background,
    foreground;

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// div ID for html = chartData

function setChart(csvMaster){

  // Extract the list of dimensions and create a scale for each.
  xScale.domain(dimensions = d3.keys(csvMaster[0]).filter(function(d) {
    return d != "name" && (yScale[d] = d3.scaleLinear()
        .domain(d3.extent(csvMaster, function(p) { return +p[d]; }))
        .range([height, 0]));
  }));

  // Add grey background lines for context.
  background = svg.append("g")
      .attr("class", "background")
    .selectAll("path")
      .data(csvMaster)
    .enter().append("path")
      .attr("d", path);

  // Add blue foreground lines for focus.
  foreground = svg.append("g")
      .attr("class", "foreground")
    .selectAll("path")
      .data(csvMaster)
    .enter().append("path")
      .attr("d", path);

  // Add a group element for each dimension.
  var g = svg.selectAll(".dimension")
      .data(dimensions)
    .enter().append("g")
      .attr("class", "dimension")
      .attr("transform", function(d) { return "translate(" + xScale(d) + ")"; })
      .call(d3.behavior.drag()
        .origin(function(d) { return {xScale: x(d)}; })
        .on("dragstart", function(d) {
          dragging[d] = xScale (d);
          background.attr("visibility", "hidden");
        })
        .on("drag", function(d) {
          dragging[d] = Math.min(width, Math.max(0, d3.event.xScale ));
          foreground.attr("d", path);
          dimensions.sort(function(a, b) { return position(a) - position(b); });
          xScale .domain(dimensions);
          g.attr("transform", function(d) { return "translate(" + position(d) + ")"; })
        })
        .on("dragend", function(d) {
          delete dragging[d];
          transition(d3.select(this)).attr("transform", "translate(" + xScale (d) + ")");
          transition(foreground).attr("d", path);
          background
              .attr("d", path)
            .transition()
              .delay(500)
              .duration(0)
              .attr("visibility", null);
        }));

  // Add an axis and title.
  g.append("g")
      .attr("class", "axis")
      .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
    .append("text")
      .style("text-anchor", "middle")
      .attr("yScale", -9)
      .text(function(d) { return d; });

  // Add and store a brush for each axis.
  g.append("g")
      .attr("class", "brush")
      .each(function(d) {
        d3.select(this).call(yScale[d].brush = d3.svg.brush().y(yScale[d]).on("brushstart", brushstart).on("brush", brush));
      })
    .selectAll("rect")
      .attr("xScale ", -8)
      .attr("width", 16);


}; // end of setChart

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
}



$(document).ready(createMap);
$(document).ready(smoothScroll);