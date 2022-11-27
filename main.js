import {
  CLIMATIQ_KEY,
  GEOAPIFY_KEY,
  ALLOWED_DISTANCE,
  MAX_AIRPORTS,
  MAX_USES,
  MODE,
} from "./_config.js";

let numLocations;

let DESTINATION_AIRPORT = "JFK";

let fileMode = "orgChart"; //orgChart, locations, airports

const clearUses = function () {
  console.log("clearing uses");
  let curUses = localStorage.getItem("carbonUses");
  if (curUses) {
    localStorage.setItem("carbonUses", 0);
  }
};

const canGetCarbon = function (expectedUses) {
  let curUses = localStorage.getItem("carbonUses");
  if (!curUses) {
    curUses = 0;
  } else {
    curUses = parseInt(curUses);
  }
  curUses += expectedUses;
  localStorage.setItem("carbonUses", curUses);
  if (curUses <= MAX_USES) {
    return true;
  }
  return false;
};

async function getLatLngs(locations) {
  let curLocation = 0;
  const numLocations = locations.length;

  const $coordsList = document.getElementById("found-coords");
  const $noCoordsList = document.getElementById("no-coords");
  $coordsList.innerHTML = "";
  $noCoordsList.innerHTML = "";
  let foundCoords = 0;
  let unfoundCoords = 0;

  const geoPromise = new Promise((resolve, reject) => {
    locations.forEach((location, index) => {
      const address = location.address;
      const geocodingUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
        address
      )}&apiKey=${GEOAPIFY_KEY}`;

      // call Geocoding API - https://www.geoapify.com/geocoding-api/
      fetch(geocodingUrl)
        .then((result) => result.json())
        .then((featureCollection) => {
          curLocation += 1;
          if (featureCollection.features.length === 0) {
            $noCoordsList.innerHTML += `<li>${$address}</li>`;
            unfoundCoords++;
            console.error("address not found for", address);
          } else {
            const foundAddress = featureCollection.features[0];
            if (!foundAddress.properties || !foundAddress.properties.lon) {
              console.error("lat / lon not found for", address);
              return;
            }
            foundCoords++;
            const latlng = [
              foundAddress?.properties?.lat,
              foundAddress?.properties?.lon,
            ];
            //find object in the locations array by the key value that matches location.id
            location.coords = latlng;
          }

          if (curLocation === numLocations) {
            $coordsList.innerHTML = `${foundCoords} coords found of ${numLocations} locations`;
            toggleStatVisibility(
              document.querySelector("#stat-container-coords"),
              true
            );
            resolve(locations);
          }
        });
    });
  });
  return geoPromise;
}

async function getNearestAirport(geoData) {
  const numLocs = geoData.length;
  let curLoc = 0;

  const $airportsList = document.getElementById("found-airports");
  const $noAirportsList = document.getElementById("no-airport");
  $airportsList.innerHTML = "";
  $noAirportsList.innerHTML = "";
  let foundAirports = 0;
  let unfoundAirports = 0;

  const airportPromise = new Promise((resolve, reject) => {
    geoData.forEach((location, index) => {
      const coords = location.coords;
      fetch(
        `https://aviation-edge.com/v2/public/nearby?key=748a0a-38092e&lat=${coords[0]}&lng=${coords[1]}&distance=${ALLOWED_DISTANCE}`
      )
        .then((result) => result.json())
        .then((data) => {
          curLoc += 1;

          if (data.length) {
            if (data[0].codeIataCity) {
              location.airport = data[0].codeIataCity;
            } else {
              location.airport = data[0].codeIataAirport;
            }

            foundAirports++;
          } else {
            console.log("No airport found for", location);
            unfoundAirports++;
            $noAirportsList.innerHTML += `<li>${location}</li>`;
          }
          if (curLoc === numLocs) {
            toggleStatVisibility(
              document.querySelector("#stat-container-airports"),
              true
            );
            $airportsList.innerHTML = `${foundAirports} airports found of ${numLocs} coords`;
            resolve(geoData);
          }
        });
    });
  });
  return airportPromise;
}

async function getClimatiqApi(airport) {
  const climatiqPromise = new Promise((resolve, reject) => {
    const climatiqResult = fetch(
      `https://beta3.api.climatiq.io/travel/flights`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLIMATIQ_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `{"legs":[{"from": "${airport}","to": "${DESTINATION_AIRPORT}","passengers": 1,"class": "economy"}]}`,
      }
    );
    resolve(climatiqResult);
  });
  return climatiqPromise;
}

async function getCO2FromAirport(airportData) {
  const CO2Promise = new Promise((resolve, reject) => {
    const numLocs = airportData.length;
    let curLoc = 0;
    const co2e = [];
    let totalCO2e = 0;

    const $carbonList = document.getElementById("found-carbon");
    const $noCarbonList = document.getElementById("no-carbon");
    $carbonList.innerHTML = "";
    $noCarbonList.innerHTML = "";
    let foundCarbon = 0;
    let unfoundCarbon = 0;

    airportData.forEach((location, index) => {
      if (location.airport) {
        const curIndex = 0;

        getClimatiqApi(location.airport)
          .then((result) => result.json())
          .then((data) => {
            curLoc += 1;
            if (data?.co2e) {
              const co2 = data.co2e;
              co2e.push(co2);
              totalCO2e += co2;
              // console.log(totalCO2e);
              foundCarbon++;
            } else {
              console.log("No co2e found for", index, location);
              unfoundCarbon++;
              $noCarbonList.innerHTML += `<li>${location.airport}</li>`;
            }
            if (curLoc === numLocs) {
              toggleStatVisibility(
                document.querySelector("#stat-container-carbon"),
                true
              );
              totalCO2e = (totalCO2e * 2).toFixed(2);
              $carbonList.innerHTML = `The ${foundCarbon} found location(s) have a result of ${totalCO2e} kilograms of CO2 emissions round trip, non-stop, economy class`;
              resolve(totalCO2e);
            }
          });
      } else {
        curLoc += 1;
      }
    });
  });
  return CO2Promise;
}

const getLocationsFromOrgChart = async (data) => {
  const orgChartPromise = new Promise((resolve, reject) => {
    const locations = [];
    const $locationList = document.getElementById("found-locations");
    const $noLocationList = document.getElementById("no-location");
    $locationList.innerHTML = "";
    $noLocationList.innerHTML = "";
    const numItems = data.length;
    let foundLocations = 0;
    let unfoundLocations = 0;
    data.forEach((person, index) => {
      if (person.location && person.location !== "") {
        locations.push({ address: person.location, id: index });
        foundLocations++;
      } else {
        const $noLocationItem = `${person.firstName} ${person.lastName}`;
        $noLocationList.innerHTML += `<li>${$noLocationItem}</li>`;
        unfoundLocations++;
      }
    });
    toggleStatVisibility(
      document.querySelector("#stat-container-location"),
      true
    );
    resolve(locations);
  });
  return orgChartPromise;
};

const getCarbonFromOrgChart = function (json) {
  postStatusMessage("Getting locations");
  getLocationsFromOrgChart(json)
    .then((locations) => {
      postStatusMessage("Getting coordinates");
      return getLatLngs(locations);
    })
    .then((geoData) => {
      postStatusMessage("Getting airports");
      //console.log(geoData);
      return getNearestAirport(geoData);
    })
    .then((airportData) => {
      postStatusMessage("Getting CO2");
      //console.log(airportData);
      return getCO2FromAirport(airportData);
    })
    .then((co2Data) => {
      postStatusMessage(`These flights will result in ${co2Data} kg of CO2`);
      console.log(co2Data);
    });
};

const getCarbonFromLocations = function (locations) {
  postStatusMessage("Getting coordinates");
  getLatLngs(locations)
    .then((geoData) => {
      // console.log(geoData);
      postStatusMessage("Getting airports");
      return getNearestAirport(geoData);
    })
    .then((airportData) => {
      // console.log(airportData);
      postStatusMessage("Getting CO2");
      return getCO2FromAirport(airportData);
    })
    .then((co2Data) => {
      postStatusMessage(`These flights will result in ${co2Data} kg of CO2`);
      console.log(co2Data);
    });
};

const getCarbonFromAirports = function (locations) {
  postStatusMessage("Getting CO2");
  getCO2FromAirport(locations).then((co2Data) => {
    postStatusMessage(`These flights will result in ${co2Data} kg of CO2`);
    console.log(co2Data);
  });
};

const handleFileModeLocations = function (text) {
  const textArr = text.split(/\r?\n/);
  //console.log(textArr);
  if (textArr.length) {
    const canRequest = canGetCarbon(textArr.length);
    if (!canRequest) {
      postOverLimitMessage();
    } else {
      toggleStatsVisibility(true);
      const locationArray = [];
      textArr.forEach((location) => {
        locationArray.push({ address: location });
      });
      getCarbonFromLocations(locationArray);
    }
  } else {
    console.log("No locations found");
  }
};

const handleFileModeJson = function (text) {
  const json = JSON.parse(text);
  //console.log(json);
  if (json.length) {
    const canRequest = canGetCarbon(json.length);
    if (!canRequest) {
      postOverLimitMessage();
    } else {
      toggleStatsVisibility(true);
      getCarbonFromOrgChart(json);
    }
  } else {
    postStatusMessage("No valid data found in JSON file");
    console.log("invalid or empty json");
  }
};

const postStatusMessage = function (message) {
  const $status = document.getElementById("status");
  $status.innerText = message;
};

const postOverLimitMessage = function () {
  postStatusMessage(
    `Due to the cost of API usage, I'm currently limiting requests to ${MAX_USES} per person. Your request would exceed this limit. Please contact me if you'd to discuss options.`
  );
};

const postInitialStatus = function () {
  postStatusMessage(
    "Ready to calculate carbon emissions. Please input a valid 3 letter destination airport code"
  );
};

const handleFileModeAirports = function (text) {
  const textArr = text.split(/\r?\n/);
  //console.log(textArr);
  if (textArr.length) {
    const canRequest = canGetCarbon(textArr.length);
    if (!canRequest) {
      postOverLimitMessage();
    } else {
      toggleStatsVisibility(true);
      const locationArray = [];
      textArr.forEach((location) => {
        locationArray.push({ airport: location });
      });
      getCarbonFromAirports(locationArray);
    }
  } else {
    postStatusMessage("No airports found");
    console.log("No airports found");
  }
};

const handleFileSelect = function (evt) {
  clearAllStats();
  hideAllStats();
  toggleStatsVisibility(false);
  postStatusMessage("Loading file");
  const files = evt.target.files; // FileList object
  const reader = new FileReader();
  reader.onload = function (e) {
    const text = reader.result;
    if (fileMode === "orgChart") {
      handleFileModeJson(text);
    } else if (fileMode === "locations") {
      handleFileModeLocations(text);
    } else if (fileMode === "airports") {
      handleFileModeAirports(text);
    } else {
      postStatusMessage("Invalid File Mode");
      console.log("Invalid file mode");
    }
  };
  reader.readAsText(files[0]);
};

const handleInputMode = function () {
  document.querySelector(".file-container").style.display = "none";
  document.querySelector(".input-container").style.display = "block";
};

const handleFileUploadMode = function () {
  document.querySelector(".file-container").style.display = "block";
  document.querySelector(".input-container").style.display = "none";
};

const handleEmptyMode = function () {
  document.querySelector(".file-container").style.display = "none";
  document.querySelector(".input-container").style.display = "none";
};

const clearAllFields = function () {
  document.getElementById("input").value = "";
  document.getElementById("file").value = "";
};

const handleFileModeChange = function (e) {
  fileMode = e.target.value;
  hideAllStats();
  clearAllStats();
  clearAllFields();
  if (fileMode === "input") {
    handleInputMode();
  } else if (fileMode === "") {
    handleEmptyMode();
  } else {
    handleFileUploadMode();
  }
};

const handleDirectInputSubmit = function (e) {
  if (fileMode === "input") {
    clearAllStats();
    hideAllStats();
    toggleStatsVisibility(false);
    const $input = document.getElementById("input");
    const inputVal = $input.value;
    handleFileModeAirports(inputVal);
  } else {
    postStatusMessage("Invalid File Mode");
    console.log("Invalid file mode");
  }
};

const handleDestinationAirportSubmit = function (e) {
  const $input = document.getElementById("destination-airport");
  const inputVal = $input.value;
  if (inputVal.length === 3) {
    DESTINATION_AIRPORT = inputVal;
    const $fileModeContainer = document.getElementById("file-mode-container");
    $fileModeContainer.style.display = "block";
  } else {
    console.error("Invalid airport code");
    postStatusMessage(
      "Invalid airport code. Please enter a valid 3 letter airport code"
    );
  }
};

const addListeners = function () {
  document
    .getElementById("file")
    .addEventListener("change", handleFileSelect, false);

  document
    .getElementById("filemode")
    .addEventListener("change", handleFileModeChange, false);

  document
    .getElementById("direct-input-submit")
    .addEventListener("click", handleDirectInputSubmit, false);

  document
    .getElementById("destination-airport-submit")
    .addEventListener("click", handleDestinationAirportSubmit, false);
};

const toggleStatsVisibility = function (visible = false) {
  if (visible) {
    document.querySelector(".stats-container").style.display = "block";
  } else {
    document.querySelector(".stats-container").style.display = "none";
  }
};

const toggleStatVisibility = function ($stat, visible = false) {
  if (visible) {
    $stat.style.display = "block";
  } else {
    $stat.style.display = "none";
  }
};

const hideAllStats = function () {
  const $statContainers = document.querySelectorAll(".stat-container");
  $statContainers.forEach(($stat) => {
    toggleStatVisibility($stat, false);
  });
};

const clearStat = function ($stat) {
  $stat.querySelector(`.stats-output`).innerHTML = "";
  $stat.querySelector(`.stats-list`).innerHTML = "";
};

const clearAllStats = function () {
  const $statContainers = document.querySelectorAll(".stat-container");
  $statContainers.forEach(($stat) => {
    clearStat($stat);
  });
};

const checkMode = function () {
  if (MODE && MODE === "development") {
    const $postLoadContainer = document.getElementById("post-load-container");
    $postLoadContainer.innerHTML = `<button id="clear-uses" class="invisible-btn"></button>`;
    document
      .getElementById("clear-uses")
      .addEventListener("click", clearUses, false);
  }
};

const init = async function () {
  checkMode();
  addListeners();
  hideAllStats();
  postInitialStatus();
};

//on document ready
document.addEventListener("DOMContentLoaded", function (event) {
  init();
});
