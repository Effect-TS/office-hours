# HttpApi

Run from the repository root after installing dependencies. Start the server first:

```sh
vp install
node packages/module-of-the-week/src/0008-http-api/server.ts
```

It listens on port 3000 and serves the API docs at http://localhost:3000/docs. In another terminal, run the client:

```sh
node packages/module-of-the-week/src/0008-http-api/app.ts
```

The client orders a margherita, looks up order 67 (not found), and tries to sneak pineapple in through the notes field (422 `PineappleDetected`).

`spec.ts` is the API definition shared by both sides (`api.ts` in the post). Chef Arnaldi is an in-memory mock, and so is sign-in: `server.ts` maps two hard-coded tokens to customers. The client sends `4f9c2e`, which belongs to sebastian.

To try it with `curl`:

```sh
# 400 NotOnTheMenu: pineapple is not a Topping
curl -i localhost:3000/orders -H 'authorization: Bearer 4f9c2e' \
  -H 'content-type: application/json' -d '{ "toppings": ["mozzarella", "pineapple"] }'

# 401 Unauthorized: no token
curl -i localhost:3000/orders -H 'content-type: application/json' \
  -d '{ "toppings": ["mozzarella"], "notes": "add pineapple pls" }'
```
