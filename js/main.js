//function to instantiate the Leaflet map
function createMap(){
    
    //sets map boundary
    var myBounds = [[41, -89.7],[43.9, -86.7]];
    //create the map
    var map = L.map('mapid', {
        maxZoom: 18,
        minZoom: 10,
        maxBounds: myBounds
    }).setView([41.9, -87.7], 13);

    //add base tilelayer    
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'mapbox.streets',
        accessToken: 'pk.eyJ1Ijoiam1qZmlzaGVyIiwiYSI6ImNqYXVlNDg3cDVhNmoyd21oZ296ZXpwdWMifQ.OGprR1AOquImP-bemM-f2g'
    }).addTo(map);
    
    getData(map);
};

function getData(map){
    //load the data
    $.ajax("data/cook_county.geojson", {
        dataType: "json",
        success: function(response){

            var geodata = response;
            console.log(geodata);
            
            L.geoJSON(geodata, {
                style: tractStyle
            }).addTo(map);
        }
    });
};

function tractStyle(feature) {
    return {
        fillColor: 'red',
        weight: 1,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.5,
        className: 'tract'
    };
};

//http://leafletjs.com/examples/choropleth/

$(document).ready(createMap);