//function to instantiate the Leaflet map
function createMap(){
    //set first choropleth field
    var expressed = 'PCIPCTCHG';
    
    //sets map boundary - needs tweaking
    var myBounds = [[41, -89.7],[43.9, -86.7]];
    
    //create the map
    var map = L.map('mapid', {
        maxZoom: 18,
        minZoom: 10,
        maxBounds: myBounds
    }).setView([41.92, -87.75], 12);

    //add base tilelayer    
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'mapbox.streets',
        accessToken: 'pk.eyJ1Ijoiam1qZmlzaGVyIiwiYSI6ImNqYXVlNDg3cDVhNmoyd21oZ296ZXpwdWMifQ.OGprR1AOquImP-bemM-f2g'
    }).addTo(map);
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.json, "data/cook_county.topojson") //async load tracts
        .await(callback);
    
    function callback (error, tractsTopo) {
        
        var tracts = topojson.feature(tractsTopo, tractsTopo.objects.cook_county).features;
        
        //create D3 scale
        var colorScale = makeColorScale(expressed,tracts);
        
        //call function to add tracts
        var layer = addTracts(expressed, map, tracts, colorScale);
        map.addLayer(layer)
        
        addButtons(map, tracts, layer);
    
    };
};

function addButtons(map, tracts, layer){
    
    var options = ['UERPCTCHG','PCIPCTCHG','POVPCTCHG','POPPCTCHG','BLKPCTCHG',
                   'ASNPCTCHG','HSPPCTCHG','WHTPCTCHG','HSPCTCHG','PHSPCTCHG','ORRPCTCHG'];
    
    var buttons = d3.select("body")
        .append("div")
        .attr("class", "buttons")
    
    var button = buttons.selectAll('.button')
        .data(options)
        .enter()
        .append("svg")
        .attr("class", "button")
        .attr("height", "50px")
        .attr("width", "100px")
        .on("click", function(d){
            changeDisplay(d, map, tracts, layer);
        })
        .append("text")
        .attr("x", "0")
        .attr("y", "10")
        .html(function (d) {
            return d
        });
};

function changeDisplay(d, map, tracts, layer){
    
    var expressed = d;
    
    var colorScale = makeColorScale(expressed,tracts);
    
    map.removeLayer(layer);
    
    var layer = addTracts(expressed, map, tracts, colorScale);
    
    map.addLayer(layer)
    
    
    
}

function addTracts(expressed, map, tracts, colorScale) { //source: http://bl.ocks.org/Caged/5779481
    
    //create layer with styling and other features
    var layer = L.geoJson(tracts, {
        style: function(feature){return setStyle(feature, colorScale, expressed)},
        onEachFeature: onEachFeature
    })
    
    return layer

    
};

function onEachFeature(feature, layer) {
    
    var lookUp = ['2016_POP','2010_POP','2016_BLACK','2010_BLACK','2016_ASIAN',
                  '2010_ASIAN','2016_HISP','2010_HISP','2016_WHITE','2010_WHITE',
                  '2016_HS','2010_HS','2016_POSTH','2010_POSTH','2016_PCTHM',
                  '2010_PCTHM','2016_OWNER','2010_OWNER','2016_RENT','2010_RENT'];
    
    var fields = ['2016 Population: ','2010 Population: ','2016 Black Pop: ','2010 Black Pop: ',
                  '2016 Asian Pop: ','2010 Asian Pop: ','2016 Hispanic Pop: ','2010 Hispanic Pop: ',
                  '2016 White Pop: ','2010 White Pop: ','2016 High School or Less Pop: ',
                  '2010 High School or Less Pop: ','2016 At Least Some College Pop: ',
                  '2010 At Least Some College Pop: ','2016 Percent Homeless: ','2010 Percent Homeless: ',
                  '2016 Home Owner Pop: ','2010 Home Owner Pop: ',
                  '2016 Home Renter Pop: ','2010 Home Renter Pop: '];
    
    var popupContent = '';
    
    for (var i=0; i < lookUp.length; i++){
        var stat = String(feature.properties[lookUp[i]]);
        popupContent += fields[i];
        popupContent += stat;
        popupContent += '<br>';
    }
    
    layer.bindPopup(popupContent, {
        maxHeight: 180,
        minWidth: 300,
        className: 'popup'});
};

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
        "color": fillColor,
        "fillOpacity": 0.5,
        "weight": .1
    };

    return myStyle;
}

function makeColorScale(expressed,tracts){
    
    var colorClasses = ['#d7191c','#fdae61','#ffffbf','#a6d96a','#1a9641'];

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
};

$(document).ready(createMap);