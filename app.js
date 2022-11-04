const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const InitializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

InitializeDBAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = "${username}";`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (isPasswordCorrect === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfgh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const middlewareFun = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfgh", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertToResponseObj = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};

app.get("/states/", middlewareFun, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state;`;
  const getAllStates = await db.all(getAllStatesQuery);
  response.send(getAllStates.map((s) => convertToResponseObj(s)));
});

app.get("/states/:stateId/", middlewareFun, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = "${stateId}";`;
  const getState = await db.get(getStateQuery);
  response.send({
    stateId: getState.state_id,
    stateName: getState.state_name,
    population: getState.population,
  });
});

app.post("/districts/", middlewareFun, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
                            VALUES("${districtName}",${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(createDistQuery);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", middlewareFun, async (request, response) => {
  const { districtId } = request.params;
  const getDistQuery = `SELECT * FROM district WHERE district_id = "${districtId}";`;
  const getDist = await db.get(getDistQuery);
  response.send({
    districtId: getDist.district_id,
    districtName: getDist.district_name,
    stateId: getDist.state_id,
    cases: getDist.cases,
    cured: getDist.cured,
    active: getDist.active,
    deaths: getDist.deaths,
  });
});

app.delete(
  "/districts/:districtId/",
  middlewareFun,
  async (request, response) => {
    const { districtId } = request.params;
    const delDistQuery = `DELETE FROM district WHERE district_id = "${districtId}";`;
    const delDist = await db.get(delDistQuery);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId/", middlewareFun, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const { districtId } = request.params;

  const updateDistQuery = `UPDATE district SET 
    district_name = "${districtName}",
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} WHERE district_id = ${districtId};`;

  await db.run(updateDistQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", middlewareFun, async (request, response) => {
  const { stateId } = request.params;

  const stateStatisticsQuery = `SELECT SUM(cases), SUM(cured), SUM(active), SUM(deaths) FROM district WHERE state_id = ${stateId};`;
  const stateStatistics = await db.get(stateStatisticsQuery);
  response.send({
    totalCases: stateStatistics["SUM(cases)"],
    totalCured: stateStatistics["SUM(cured)"],
    totalActive: stateStatistics["SUM(active)"],
    totalDeaths: stateStatistics["SUM(deaths)"],
  });
});

module.exports = app;
