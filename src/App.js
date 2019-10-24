import { hot } from "react-hot-loader/root";
import React, { Component } from "react";
import {
  CssBaseline,
  Button,
  TextField,
  Grid,
  Modal,
  Backdrop,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  BottomNavigation,
  BottomNavigationAction
} from "@material-ui/core";
import { Sync, Delete, Add } from "@material-ui/icons";
import { ipcRenderer } from "electron";
import styled, { keyframes, createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  
`;
const SpinAnim = keyframes`
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
`;
const SyncSpin = styled(Sync)`
  animation: ${SpinAnim} 2s 0s infinite linear;
`;
const DirText = styled(TextField)`
  width: 100%;
`;
const DirItemContainer = styled(Grid)`
  width: 100%;
`;
const Container = styled.div`
  padding: 1em;
`;
const BottomNavigationStyled = styled(BottomNavigation)`
  position: absolute;
  width: 100%;
  bottom: 0;
  left: 0;
`;
class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      dirs: [],
      syncingAll: false,
      syncingDir: [],
      isAddModalOpen: false,
      addWatchData: {}
    };
  }

  componentDidMount() {
    ipcRenderer.send("componentDidMount");

    ipcRenderer.on("reload", (event, dirs) => {
      this.setState({
        isAddModalOpen: false,
        addWatchData: {}
      });
    });
    ipcRenderer.on("getDirs", (event, dirs) => {
      console.log("getDirs");
      this.setState({ dirs });
    });
    ipcRenderer.on("syncAllStart", (event, arg) => {
      console.log("syncAllStart");
      this.setState({
        syncingAll: true
      });
    });
    ipcRenderer.on("syncAllEnd", (event, arg) => {
      console.log("syncAllEnd");
      this.setState({
        syncingAll: false
      });
    });
    ipcRenderer.on("syncStart", (event, arg) => {
      console.log("syncStart: " + arg);
      this.state.syncingDir.push(arg);
      this.setState({
        syncingDir: this.state.syncingDir
      });
    });
    ipcRenderer.on("syncEnd", (event, arg) => {
      console.log("syncEnd: " + arg);
      this.state.syncingDir.shift();
      this.setState({
        syncingDir: this.state.syncingDir
      });
    });
    ipcRenderer.on("selectDirResult", (event, arg) => {
      if (arg.type === "from") {
        this.setState({
          addWatchData: {
            ...this.state.addWatchData,
            from: arg.filePath
          }
        });
      } else if (arg.type === "to") {
        if (this.state.addWatchData.from === arg.filePath) {
          alert('Select different directory with "from"');
          return;
        }
        this.setState({
          addWatchData: {
            ...this.state.addWatchData,
            to: arg.filePath
          }
        });
      }
    });
  }

  syncAll() {
    ipcRenderer.send("syncAll");
  }
  sync(fromDir) {
    ipcRenderer.send("sync", fromDir);
  }

  render() {
    return (
      <React.Fragment>
        <CssBaseline />
        <GlobalStyle />
        <AppBar position="static" color="primary">
          <Toolbar>
            <Typography variant="h6">
              <span role="img" aria-label="duck">
                🐥
              </span>{" "}
              DuckSync
            </Typography>
          </Toolbar>
        </AppBar>
        <Container>
          {this.state.dirs.map((item, key) => (
            <Paper style={{ marginBottom: 12, padding: 12 }}>
              <DirItemContainer
                key={key}
                container
                spacing={1}
                justify="center"
                alignItems="center"
                alignContent="center"
              >
                <Grid item sm={5}>
                  <DirText
                    label="From"
                    value={item.from}
                    margin="normal"
                    variant="outlined"
                    disabled
                  />
                </Grid>
                <Grid item sm={5}>
                  <DirText
                    label="to"
                    value={item.to}
                    margin="normal"
                    variant="outlined"
                    disabled
                  />
                </Grid>
                <Grid item sm={1}>
                  <IconButton
                    onClick={e => this.sync(item.from)}
                    disabled={this.state.syncingDir.indexOf(item.from) !== -1}
                    color="primary"
                  >
                    {this.state.syncingDir.indexOf(item.from) !== -1 ? (
                      <SyncSpin />
                    ) : (
                      <Sync />
                    )}
                  </IconButton>
                </Grid>
                <Grid item sm={1}>
                  <IconButton
                    onClick={e => ipcRenderer.send("removeWatch", item)}
                    disabled={this.state.syncingDir.indexOf(item.from) !== -1}
                  >
                    <Delete />
                  </IconButton>
                </Grid>
              </DirItemContainer>
            </Paper>
          ))}
          <Modal open={this.state.isAddModalOpen} BackdropComponent={Backdrop}>
            <Paper>
              <DirItemContainer
                container
                spacing={2}
                justify="center"
                alignItems="center"
              >
                <Grid item sm={5}>
                  <DirText
                    label="From"
                    placeholder="Select folder to watch."
                    helperText="Directory to watch."
                    value={this.state.addWatchData.from}
                    margin="normal"
                    variant="outlined"
                    disabled
                    onClick={e => ipcRenderer.send("selectDir", "from")}
                    InputLabelProps={{
                      shrink: true
                    }}
                  />
                </Grid>
                <Grid item sm={5}>
                  <DirText
                    label="to"
                    placeholder="Select folder to sync."
                    helperText="Directory to sync."
                    value={this.state.addWatchData.to}
                    margin="normal"
                    variant="outlined"
                    disabled
                    onClick={e => ipcRenderer.send("selectDir", "to")}
                    InputLabelProps={{
                      shrink: true
                    }}
                  />
                </Grid>
              </DirItemContainer>
              <Grid
                container
                justify="center"
                alignItems="center"
                alignContent="center"
                spacing={3}
              >
                <Grid item>
                  <Button
                    size="large"
                    onClick={e => {
                      this.setState({
                        isAddModalOpen: false
                      });
                    }}
                  >
                    Close
                  </Button>
                </Grid>
                <Grid item>
                  <Button
                    size="large"
                    color="primary"
                    onClick={e => {
                      if (
                        this.state.addWatchData.from &&
                        this.state.addWatchData.to
                      ) {
                        ipcRenderer.send("addWatch", this.state.addWatchData);
                      } else {
                        alert("Select from and to directory.");
                      }
                    }}
                  >
                    Add Watch
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Modal>
        </Container>
        <BottomNavigationStyled showLabels>
          <BottomNavigationAction
            label={this.state.syncingAll ? "Syncing All..." : "Sync All"}
            icon={this.state.syncingAll ? <SyncSpin /> : <Sync />}
            onClick={e => this.syncAll()}
            disabled={this.state.syncingAll}
          />
          <BottomNavigationAction
            label="Add Watch"
            icon={<Add />}
            onClick={e =>
              this.setState({
                isAddModalOpen: true
              })
            }
          />
        </BottomNavigationStyled>
      </React.Fragment>
    );
  }
}

export default hot(App);
