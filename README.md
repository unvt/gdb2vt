# gdb2vt
Vector tile conversion from Esri geodatabase (nodejs script).  
I used this script to convert global contour line data into vector tiles.

# How it works
Once you run index.js, the source gdb data is read/exported (with gdal) and parsed (with json-text-sequence module) to be temporary saved as geojsons file. Then, geojsons files are imported to tippecanoe to be vector tiles.

# Output vector tiles
Vector tiles will be generated as mbtiles file.
By specifying spatial extents (modules) in a config file, we can get mbtiles for each extent.


# Environment
This is developed with the following environment (on a container)
* node v16.15.0
* npm 8.5.5
* gdal 3.4.1
* tippecanoe v1.36.0
* OS: Ubuntu 22.04 LTS 

# Configuration
Edit config/default.hjson to change the configuration setting.
* minzoom/maxzoom --> They are the min/max zoom for all. Each layer's zoom can be specified with srcdb.maxzoom/srcdb.minzoom.
* srcdb --> location of source data, etc. I developed index.js with a single srcdb. (Please edit index.js if you want to work with more than one source.)
  * srcdb.url --> location/name of the source
  * srcdb.layer --> name of the vector tile layer
  * srcdb.tiles --> extent of the converted vector tiles, specified in [z, x, y] order. You can list more than one extents. You will get a mbtiles named z-x-y.mbltiles. 
* ogr2ogrPath --> ogr2ogr(gdal) path. Make sure that the version of your gdal is good enough. (Older version may not be able to export geojsons.) 
* tippecanoePath --> location of tippecanoe. Make sure that you have installed tippecanoe.
* concurrent --> number of parallel processing.
* mbtilesDir --> directory where the mbitles are generated
* geojsonsDir --> directory where the intermediate geojsons files are stored. (They are deleted after mbtiles comversion is done.)


# License
See LICENSE. This is unlicense.

# Note: Geodata base layer
Because my source gdb had only a single layer, I did not specify the layer name during the conversion.
If you wants to add layer, you can do so by adding layername in the ogr2ogr parameters (layer name will be added after the name of the source gdb.).

