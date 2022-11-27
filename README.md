# Group Flight Carbon Calculator

This app allows you to upload a list of departure locations or airport codes, and calculate the CO2 emissions of all flights round trip to a specified destination airport.

### Instructions

#### Request Limit

I am currently limiting the number of requests due to API overage costs if I exceed my quota. If you hit your limit need additional requests, please contact me. If you would like to support this project financially so I can offer it freely to others, I'd love the assistance!

#### List Mode

Select from one of the following list modes:

* **Org Chart**: A valid .json file array with the structure:
`[{"location":"MY_LOCATION"},{"location":"MY_SECOND_LOCATION"},...]`
* **Locations**: A .txt file with one location per line. The system will look up the closest airport for carbon calculation
* **Airports**: A .txt file with one 3 letter airport code per line
* **Direct Input**: Paste your 3 letter airport codes for which you want to calculate carbon below


### Assumptions

Carbon calculations assume round-trip, non-stop, flying solo, and flying economy class. 

### How it works

The app uses several APIs to make it work:

* [Geoapify](https://www.geoapify.com/) is used to geocode any non-airport code locations
* [Aviation Edge](http://aviation-edge.com) is used to find the closest airport to a given location
* [Climatiq](https://www.climatiq.io/) is used to calculate the carbon emissions of the flight

