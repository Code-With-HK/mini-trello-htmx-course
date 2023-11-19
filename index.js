import express from "express";
import { engine } from "express-handlebars";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import handlebars from "handlebars";
import { readFileSync } from "fs";
import { v4 as uuid } from "uuid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "db.json");

const PORT = 3000;
const app = express();

app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", [`${__dirname}/views`]);

app.use(express.urlencoded({ extended: false }));

app.use(express.static(`${__dirname}/public`));

const adapter = new JSONFile(file);
const defaultData = { lists: [] };
const db = new Low(adapter, defaultData);

await db.read();

const addNewList = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/add-new-list.handlebars`, "utf-8")
);

const list = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/list.handlebars`, "utf-8")
);

const listHeader = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/list-header.handlebars`, "utf-8")
);

const addNewCard = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/add-new-card.handlebars`, "utf-8")
);

const cardItem = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/card-item.handlebars`, "utf-8")
);

app.get("/", (req, res) => {
  const { lists } = db.data;
  res.render("index", {
    partials: { addNewList, list, listHeader, addNewCard, cardItem },
    lists,
  });
});

app.get("/new-list", (req, res) => {
  res.render("partials/new-list", { layout: false });
});

app.get("/add-new-list", (req, res) => {
  res.render("partials/add-new-list", { layout: false });
});

app.post("/lists", async (req, res) => {
  const { name } = req.body;
  const newList = { listId: uuid(), name, cards: [] };
  db.data.lists.push(newList);
  await db.write();

  res.render("partials/list-with-new-list-btn", {
    layout: false,
    partials: { addNewList, list, listHeader, addNewCard, cardItem },
    ...newList,
  });
});

app.get("/lists/edit/:listId", (req, res) => {
  const { listId } = req.params;
  const list = db.data.lists.find((list) => list.listId === listId);

  if (!list) {
    return res.status(400).send("Invalid List ID");
  }

  res.render("partials/edit-list", {
    layout: false,
    ...list,
  });
});

app.patch("/lists/:listId", async (req, res) => {
  const { listId } = req.params;
  const { name } = req.body;
  const list = db.data.lists.find((list) => list.listId === listId);

  if (!list) {
    return res.status(400).send("Invalid List ID");
  }

  list.name = name;
  await db.write();

  res.render("partials/list-header", {
    layout: false,
    ...list,
  });
});

app.delete("/lists/:listId", async (req, res) => {
  const { listId } = req.params;
  const idx = db.data.lists.findIndex((list) => list.listId === listId);
  if (idx === -1) {
    return res.status(400).send("Invalid List ID");
  }
  db.data.lists.splice(idx, 1);
  await db.write();

  res.status(200).send("");
});

app.get("/lists/:listId/new-card", (req, res) => {
  const { listId } = req.params;
  res.render("partials/new-card-form", { layout: false, listId });
});

app.get("/lists/:listId/add-new-card", (req, res) => {
  const { listId } = req.params;
  res.render("partials/add-new-card", { layout: false, listId });
});

app.post("/lists/:listId/cards", async (req, res) => {
  const { listId } = req.params;
  const { name } = req.body;

  const list = db.data.lists.find((list) => list.listId === listId);

  if (!list) {
    return res.status(400).send("Invalid List ID");
  }
  const newCard = { name, cardId: uuid(), listId };
  list.cards.push(newCard);
  await db.write();

  res.render("partials/card-item-with-add-card", {
    layout: false,
    partials: { addNewCard, cardItem },
    ...newCard,
  });
});

app.delete("/lists/:listId/cards/:cardId", async (req, res) => {
  const { listId, cardId } = req.params;
  const list = db.data.lists.find((list) => list.listId === listId);

  if (!list) {
    return res.status(400).send("Invalid List ID");
  }
  const cardIdx = list.cards.findIndex((card) => card.cardId === cardId);
  if (cardIdx === -1) {
    return res.status(400).send("Invalid Card ID");
  }
  list.cards.splice(cardIdx, 1);
  await db.write();

  res.status(200).send("");
});

app.get("/lists/:listId/cards/:cardId", (req, res) => {
  const { listId, cardId } = req.params;
  const list = db.data.lists.find((list) => list.listId === listId);

  if (!list) {
    return res.status(400).send("Invalid List ID");
  }
  const card = list.cards.find((card) => card.cardId === cardId);
  if (!card) {
    return res.status(400).send("Invalid Card ID");
  }

  res.render("partials/edit-card", { layout: false, ...card });
});

app.patch("/lists/:listId/cards/:cardId", async (req, res) => {
  const { listId, cardId } = req.params;
  const { name } = req.body;
  const list = db.data.lists.find((list) => list.listId === listId);

  if (!list) {
    return res.status(400).send("Invalid List ID");
  }
  const card = list.cards.find((card) => card.cardId === cardId);
  if (!card) {
    return res.status(400).send("Invalid Card ID");
  }
  card.name = name;
  await db.write();

  return res.render("partials/card-item", {
    layout: false,
    ...card,
  });
});

app.post("/lists/move", async (req, res) => {
  const { fromPosition, toPosition } = req.body;
  const fromList = db.data.lists.splice(fromPosition, 1)[0];
  db.data.lists.splice(toPosition, 0, fromList);
  await db.write();
  res.send("");
});

app.post("/cards/move", async (req, res) => {
  const { fromList, toList, fromPosition, toPosition } = req.body;
  const parsedFromList = fromList.replace("sort-list-", "");
  const parsedToList = toList.replace("sort-list-", "");

  let filteredList = db.data.lists.find(
    (list) => list.listId === parsedFromList
  );
  if (!filteredList) {
    return res.status(400).send("Invalid List ID");
  }
  const card = filteredList.cards.splice(fromPosition, 1)[0];
  if (parsedFromList !== parsedToList) {
    filteredList = db.data.lists.find((list) => list.listId === parsedToList);
    if (!filteredList) {
      return res.status(400).send("Invalid List ID");
    }
  }
  filteredList.cards.splice(toPosition, 0, card);
  await db.write();

  res.send("");
});

app.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT}`);
});
