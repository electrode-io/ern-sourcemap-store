# Electrode Native Source Map Store Server

## Setup

- Install the source map store server

```bash
npm install -g ern-sourcemap-store
```

- Start the source map store server (with default configuration)

```bash
ern-sourcemap-store
```

`ern-sourcemap-store` executable expose the following command line options:

- `--host <string>` The server host/ip (_default: 0.0.0.0_)
- `--port <number>` The server port (_default 3000_)
- `--max-container-maps <number>` Maximum number of container source maps to keep (per application version) (_default -1_)
- `--max-codepush-maps <number>` Maximum number of code push source maps to keep (per application version) (_default -1_)
- `--store-path <string>` Local path to the directory containing the database and store files (_default to \$cwd/store_)

## Development

If you are only planning to use the Source Map Store server with Electrode Native, you shouldn't pay much attention to this section unless you wish to know more about the different routes exposed by the server.

On the other hand, if you are interested in contributing to this project, or forking it for your own needs, this section might prove useful.

- To run from source :

```
npm start
```

- To run the tests :

```
npm test
```

### `REST API routes`

#### GET /status

_Get the current status of the server_

Response will always return `HTTP 200 OK` status code as long as the server is running.

#### GET /db

_Return current database object as JSON_

#### POST /symbolicate/container/:app/:platform/:version/:containerVersion

_Symbolicate a stack trace of a Container bundle_

Content-Type header should be set to `text/plain`

Can be used to symbolicate the JS stack trace of an exception being thrown from the bundle included in a specific Container.

Example:

`POST /symbolicate/container/myapp/android/1.0.0/19.0.0`

Sample Request Body

```
onPress@364:619
touchableHandlePress@203:2130
touchableHandlePress@195:9628
```

Sample Response Body

```
onPress@25:65 [miniappA/App.js]
touchableHandlePress@213:45 [react-native/Libraries/Components/Touchable/TouchableNativeFeedback.android.js]
touchableHandlePress@878:34 [react-native/Libraries/Components/Touchable/Touchable.js]
```

Symbolicate the provided JS stack trace, that is being thrown from Container version `19.0.0` of `myapp:android:1.0.0` native application version. The symbolicated stack trace will contain the `line`/`column` of original source file, along with source file path.

#### POST /symbolicate/codepush/:app/:platform/:version/:deploymentName/:label

_Symbolicate a stack trace of a CodePush bundle_

Content-Type header should be set to `text/plain`

Can be used to symbolicate the JS stack trace of an exception being thrown from a bundle that has been code pushed.

Example:

`POST /symbolicate/codepush/myapp/android/1.0.0/Production/v37`

Sample Request Body

```
onPress@364:619
touchableHandlePress@203:2130
touchableHandlePress@195:9628
```

Sample Response Body

```
onPress@25:65 [miniappA/App.js]
touchableHandlePress@213:45 [react-native/Libraries/Components/Touchable/TouchableNativeFeedback.android.js]
touchableHandlePress@878:34 [react-native/Libraries/Components/Touchable/Touchable.js]
```

Symbolicate the provided JS stack trace, that is being thrown from a `Production` bundle with label `v37` that was CodePush to `myapp:android:1.0.0` native application version. The symbolicated stack trace will contain the `line`/`column` of original source file, along with source file path.

#### POST /sourcemaps/container/:app/:platform/:version/:containerVersion

_Upload the source map of a Container bundle to the server_

The sourcemap should be attached to the request as multi part file upload using `sourcemap` field name.

Example:

`POST /sourcemaps/container/myapp/android/1.0.0/19.0.0`

Upload the source map of the bundle of `myapp:android:1.0.0` Container `v19.0.0`

#### POST /sourcemaps/codepush/:app/:platform/:version/:deploymentName/:label

_Upload the source map of a CodePush bundle to the server_

The sourcemap should be attached to the request as multi part file upload using `sourcemap` field name.

Example:

`POST /sourcemaps/codepush/myapp/android/1.0.0/Production/v37`

Upload the source map of the bundle CodePushed to `Production` deployment name with label `v37` of `myapp:android:1.0.0` native application version.

#### POST /sourcemaps/codepush/copy/:app/:platform/:version/:deploymentName/:label/:toVersion/:toDeploymentName/:toLabel

_Copy a CodePush source map to a different version/deployment name/label_

This can be used when CodePush is promoting an existing bundle, when the bundle and source map are not regenerated but instead reused.

Example:

`POST /sourcemaps/codepush/myapp/android/1.0.0/QA/v37/1.0.0/Production/v38`

Copy the sourcemap associated to the bundle CodePushed to `QA` with label `v37`, to Production with label `v38` for the same native application version (this mostly correspond to a bundle that has been promoted on the CodePush server from `QA` to `Production`)

#### GET /sourcemaps/container/:app/:platform/:version/:containerVersion

_Download a Container bundle source map from the server_

Example:

`GET /sourcemaps/container/myapp/android/1.0.0/19.0.0`

Download the source map of Container `v19.0.0` of `myapp:android:1.0.0` native application version.

#### GET /sourcemaps/codepush/:app/:platform/:version/:deploymentName/:label

_Download a CodePush bundle source map from the server_

Example:

`GET /sourcemaps/codepush/myapp/android/1.0.0/Production/v37`

Download the source map of the bundle CodePushed to `Production` deployment name with label `v37` of `myapp:android:1.0.0` native application version.
