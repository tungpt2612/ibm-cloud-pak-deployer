import React from 'react';
import Infrastructure from './Infrastructure/Infrastructure';
import Storage from './Storage/Storage';
import Selection from './Selection/Selection';
import './Wizard.scss'
import { useState, useEffect } from 'react';
import { ProgressIndicator, ProgressStep, Button, InlineNotification, Loading, RadioButtonGroup, RadioButton, Table, TableHead, TableRow, TableBody, TableCell, TableHeader} from 'carbon-components-react';
import ProgressBar from 'carbon-components-react/lib/components/ProgressBar'
import Summary from './Summary/Summary';
import axios from 'axios';
import CloudPak from './CloudPak/CloudPak';
import fileDownload from 'js-file-download';
import yaml from 'js-yaml';

const Wizard = ({setHeaderTitle,
                 headerTitle
                }) => {

   //wizard index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wizardError, setWizardError] = useState(false);
  const [ocLoginErr, setOcLoginErr] = useState(false)
  const [checkDeployerStatusErr, setCheckDeployerStatusErr] = useState(false)

  //DeployStart hidden wizard
  const [isDeployStart, setDeployStart] = useState(false);
  const [isDeployErr, setDeployErr] = useState(false);
  const [loadingDeployStatus, setLoadingDeployStatus] = useState(false)

  //Selection
  const [selection, setSelection] = useState('Configure+Deploy')
  const [cpdWizardMode, setCpdWizardMode] = useState('')

  //Infrastructure
  const [cloudPlatform, setCloudPlatform] = useState("existing-ocp")
  const [configuration, setConfiguration] = useState({})
  const [locked, setLocked] = useState(false)
  const [envId, setEnvId] = useState("")
  //---IBM Cloud
  const [IBMCloudSettings, setIBMCloudSettings] = useState({
    IBMAPIKey: '',
    region: '',
  })
  //---AWS
  const [AWSSettings, setAWSSettings] = useState({
    accessKeyID: '',
    secretAccessKey:'',
  })
  //---Existing OpenShift
  const [OCPSettings, setOCPSettings] = useState({
    ocLoginCmd:'',
  })  
  const [isOcLoginCmdInvalid, setOcLoginCmdInvalid] = useState(false)

  //Storage
  const [storage, setStorage] = useState([])
  const [storagesOptions, setStoragesOptions] = useState([])

  //Cloud Pak
  const [CPDCartridgesData, setCPDCartridgesData] = useState([])
  const [CPICartridgesData, setCPICartridgesData] = useState([])
  const [entitlementKey, setEntitlementKey] = useState('')
  const [CP4DPlatformCheckBox, setCP4DPlatformCheckBox] = useState(false)  
  const [CP4IPlatformCheckBox, setCP4IPlatformCheckBox] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')

  const [cp4dLicense, setCp4dLicense] = useState(false)
  const [cp4iLicense, setCp4iLicense] = useState(false)
  const [cp4dVersion, setCp4dVersion] = useState("")
  const [cp4iVersion, setCp4iVersion] = useState("")

  //summary
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [tempSummaryInfo, setTempSummaryInfo] = useState("") 
  const [configInvalid, setConfigInvalid] = useState(false)  
  const [showErr, setShowErr] = useState(false)

  //deploy
  const [deployerStatus, setDeployerStatus] = useState(true)    //true or false
  const [deployerPercentageCompleted, setDeployerPercentageCompleted] = useState(0)
  const [deployerStage, setDeployerStage] = useState('')
  const [deployerLastStep, setDeployerLastStep] = useState('')
  const [deployerCompletionState, setDeployerCompletionState ] = useState('')
  const [deployerCurrentImage, setDeployerCurrentImage] = useState('')
  const [deployerImageNumber, setDeployerImageNumber] = useState('')

  const [scheduledJob, setScheduledJob] = useState(0)
  const [deployeyLog, setdeployeyLog] = useState('deployer-log')

  const [deployState, setDeployState] = useState([])
  const [configDir, setConfigDir] = useState('')
  const [statusDir, setStatusDir] = useState('')

  const [saveConfig, setSaveConfig] = useState(false)

  //For Private Registry  
  const [registryHostname, setRegistryHostname] = useState('')
  const [registryPort, setRegistryPort] = useState(443)
  const [registryNS, setRegistryNS] = useState('')
  const [registryUser, setRegistryUser] = useState('')
  const [registryPassword, setRegistryPassword] = useState('')
  const [portable, setPortable] = useState(false)

  const clickPrevious = ()=> {
    setWizardError(false)
    if (currentIndex >= 1)
       setCurrentIndex(currentIndex - 1)
  } 

  const clickNext = async()=> {
    if (currentIndex === 1 && cloudPlatform === "existing-ocp" && selection !== "Configure+Download") {
      setLoadingDeployStatus(true) 
      let result=await testOcLoginCmd();

      //test OC Login Cmd failure
      if (result!==0) {
        return
      } else {
       //test OC Login Cmd success
        if (locked) {
          let deployerStatus = await checkDeployerStatus();
          if (deployerStatus===1){
            setCheckDeployerStatusErr(false) 
            setCurrentIndex(10)
            setDeployStart(true)  
            setDeployErr(false) 
            getDeployStatus()
            refreshStatus() 
            return 
          } 
          if (deployerStatus===-1) {
            setCheckDeployerStatusErr(true) 
            return
          }
        }
      }
    }
    setWizardError(true)
    if (currentIndex <= 3)
      setCurrentIndex(currentIndex + 1)
  }

  const errorProps = () => ({
    kind: 'error',
    lowContrast: true,
    role: 'error',
    title: 'Get error to start IBM Cloud Pak deployment. ',
    hideCloseButton: false,
  }); 

  const successSaveConfigProps = () => ({
    kind: 'success',
    lowContrast: true,
    role: 'success',
    title: 'The configuration file is saved successfully!',
    hideCloseButton: false,
  }); 

  const checkDeployerStatus = async() => {
    let result = 0;
    await axios.get('/api/v1/deployer-status').then(res =>{
      if (res.data.deployer_active===true) {
        result = 1;
      }      
    }, err => {
        console.log(err) 
        result = -1;       
    });
    return result
  }

  const testOcLoginCmd = async() => {
    let patt = /oc\s+login\s+/;    
    if (!patt.test(OCPSettings.ocLoginCmd.trim())) {
      setOcLoginCmdInvalid(true)
      setLoadingDeployStatus(false) 
      return
    }   
    setOcLoginCmdInvalid(false)
    const body={
      "oc_login_command": OCPSettings.ocLoginCmd
    }
    let result=-1
    await axios.post('/api/v1/oc-login', body).then(res =>{     
      result=res.data.code            
      if (result!==0) {
        setOcLoginErr(true)    
      } else {
        setOcLoginErr(false)  
      }      
    }, err => {
      setOcLoginErr(true)
    }
    );  
    setLoadingDeployStatus(false) 
    return result;
  }

  const createDeployment = async() => {
    setLoadingDeployStatus(true)
    const body = {
      "env":{
          "ibmCloudAPIKey":IBMCloudSettings.IBMAPIKey
      },
      "entitlementKey": entitlementKey,
      "cloud": cloudPlatform,
      "envId": envId,
      "oc_login_command": OCPSettings.ocLoginCmd.trim(),
      "region": IBMCloudSettings.region,
      "adminPassword": adminPassword,
    }    
    setCurrentIndex(10)
    await axios.post('/api/v1/deploy', body).then(res =>{
        setLoadingDeployStatus(false)    
        setDeployStart(true)  
        setDeployErr(false)
        getDeployStatus()
        refreshStatus()        
  
    }, err => {
        setLoadingDeployStatus(false)    
        console.log(err)
        setDeployStart(true)
        setDeployErr(true)
    });    
  }

  const createDownload = async() => {
    setLoadingDeployStatus(true)
    const body = {  
      "entitlementKey": entitlementKey,     
      "envId": envId,  
      "registry": {
        "portable": portable,
        "registryHostname": registryHostname,
        "registryPort": registryPort,
        "registryNS": registryNS,
        "registryUser": registryUser,
        "registryPassword": registryPassword,
      }
    }    
    setCurrentIndex(10)
    await axios.post('/api/v1/mirror', body).then(res =>{
        setLoadingDeployStatus(false)    
        setDeployStart(true)  
        setDeployErr(false)
        getDeployStatus()
        refreshStatus()        
  
    }, err => {
        setLoadingDeployStatus(false)    
        console.log(err)
        setDeployStart(true)
        setDeployErr(true)
    });    
  }

  const createSaveDeloyment = async () => {
    setLoadingDeployStatus(true)
    let body = {}
    let result = {}
        
    try {                   
        yaml.loadAll(tempSummaryInfo, function (doc) {
            result = {...doc, ...result}
        }); 
        body['config'] = result 
        await axios.post('/api/v1/saveConfig', body, {headers: {"Content-Type": "application/json"}}).then(res =>{   
          setLoadingDeployStatus(false)
          setCurrentIndex(10)
          setDeployStart(true)
          setSaveConfig(true)

          if (selection==="Configure+Deploy") {
            createDeployment();
          } else if (selection==="Configure+Download") {
            createDownload();
          }
          
      }, err => {
        setLoadingDeployStatus(false)
        setShowErr(true)
        console.log(err)          
      });  

    } catch (error) {
        setLoadingDeployStatus(false)
        setConfigInvalid(true)
        console.error(error)
    } 
  }

  const getDeployStatus = async() => {
    if (isDeployErr)
      return 
    await axios.get('/api/v1/deployer-status').then(res =>{
        setDeployerStatus(res.data.deployer_active)
        if(res.data.deployer_active) {
          setDeployerPercentageCompleted(res.data.percentage_completed)
        } else {
          setDeployerPercentageCompleted(100)
        }        

        if(res.data.deployer_stage) {
          setDeployerStage(res.data.deployer_stage)
        }
        if(res.data.last_step) {
          setDeployerLastStep(res.data.last_step)
        }
        if(res.data.service_state) {
          setDeployState(res.data.service_state)
        }
        if(res.data.completion_state) {
          setDeployerCompletionState(res.data.completion_state)
        }
        if(res.data.mirror_current_image){
          setDeployerCurrentImage(res.data.mirror_current_image)
        }
        if(res.data.mirror_number_images){
          setDeployerImageNumber(res.data.mirror_number_images)
        }
    }, err => {
        console.log(err)        
    });
  }

  const refreshStatus = ()=>{
    setScheduledJob(setInterval(() => {
        getDeployStatus()
      }, 5000))
  }

  const downloadLog = async() => {
    const body = {"deployerLog":deployeyLog}
    const headers = {'Content-Type': 'application/json; application/octet-stream', responseType: 'blob'}
    await axios.post('/api/v1/download-log', body, headers).then(res =>{
      if (deployeyLog === 'all-logs') {
        fileDownload(res.data, "cloud-pak-deployer-logs.zip")
      }else {
        fileDownload(res.data, "cloud-pak-deployer.log")
      }       
    }, err => {
        console.log(err)        
    });
  }

  useEffect(() => {     
    if (isDeployStart && !isDeployErr) {   
      if (!deployerStatus) {
        clearInterval(scheduledJob)
      }
    }
    return () => {
      clearInterval(scheduledJob)
    }
    // eslint-disable-next-line
  },[deployerStatus])

  const DeployerProgressIndicator = () => {
    return (
      <ProgressIndicator className="wizard-container__page-progress"
          vertical={false}
          currentIndex={currentIndex}
          spaceEqually={false}> 
          
          <ProgressStep
            onClick={() => setCurrentIndex(0)}
            current={currentIndex === 0}
            label={'Selection'}
            description="Step 1"
          />

          <ProgressStep
            onClick={() => setCurrentIndex(1)}
            current={currentIndex === 1}
            label={'Infrastructure'}
            description="Step 2"
          />

          <ProgressStep
            onClick={() => setCurrentIndex(2)}
            current={currentIndex === 2}
            label={'Storage'}
            description="Step 3"
          />

          <ProgressStep
            onClick={() => setCurrentIndex(3)}
            current={currentIndex === 3}
            label={'Cloud Pak'}
            description="Step 4"
          />

          <ProgressStep
            onClick={() => setCurrentIndex(4)}
            current={currentIndex === 4}
            label={'Summary'}
            description="Step 5"
          />    
       </ProgressIndicator>  
    )
  }

  const oneDimensionArray2twoDimensionArray = (baseArray)=>{
    let len = baseArray.length;
    let n = 9; 
    let lineNum = len % n === 0 ? len / n : Math.floor( (len / n) + 1 );
    let res = [];
    for (let i = 0; i < lineNum; i++) {
      let temp = baseArray.slice(i*n, i*n+n);
      res.push(temp);
    }
    return res;
  }

  const headers = ['Service', 'State'];
  const tables = oneDimensionArray2twoDimensionArray(deployState);

  const ActionBySelect = () => {
    return (
      <>
        {selection==="Configure+Deploy" && <Button className="wizard-container__page-header-button" onClick={createSaveDeloyment} disabled={summaryLoading}>Deploy</Button>}
        {selection==="Configure" && <Button className="wizard-container__page-header-button" onClick={createSaveDeloyment} disabled={summaryLoading}>Save</Button>}
        {selection==="Configure+Download" && <Button className="wizard-container__page-header-button" onClick={createSaveDeloyment} disabled={summaryLoading}>Mirror</Button> }
      </>
    )
  }

  const DeployStats = () => {
    return (
      <>
        <div>
          <div className="deploy-status">Deployer Status:</div>

          {!deployerStatus && <div className="deploy-key" >
            <div>Completion state:</div>
            <div className="deploy-value">{deployerCompletionState}</div> 
          </div>}          
        
          <div className="deploy-key" >
            <div>State:</div>
            <div className="deploy-value">{deployerStatus?'ACTIVE':'INACTIVE'}</div> 
          </div>

          {deployerStage && <div className="deploy-key" >
            <div>Current Stage:</div>
            <div className="deploy-value">{deployerStage}</div> 
          </div>}

          {deployerLastStep && <div className="deploy-key" >
            <div>Current Task:</div>
            <div className="deploy-value">{deployerLastStep}</div> 
          </div>}

          {deployerCurrentImage && <div className="deploy-key" >
            <div>Current Image:</div>
            <div className="deploy-value">{deployerCurrentImage}</div> 
          </div>}

          {deployerImageNumber && <div className="deploy-key" >
            <div>Mirror Images Number:</div>
            <div className="deploy-value">{deployerImageNumber}</div> 
          </div>}
          
          
          <div className="deploy-key">
            <div>Deployer Log:</div>
            <div className="deploy-value">
              <RadioButtonGroup
                  //orientation="vertical"
                  onChange={(value)=>{setdeployeyLog(value)}}
                  legendText=""
                  name="log-options-group"
                  defaultSelected={deployeyLog}>
                  <RadioButton
                    labelText="Deployer Log Only"
                    value="deployer-log"
                    id="log-radio-1"
                  />
                  <RadioButton
                    labelText="Deployer All Logs"
                    value="all-logs"
                    id="log-radio-2"
                  />
                </RadioButtonGroup>
            </div> 
                                              
          </div>
          <div className="deploy-key" >
            <Button onClick={downloadLog}>Download</Button>
          </div>

          <div className="deploy-item">Deployer Progress:
            <ProgressBar
              label=""
              helperText=""
              value={deployerPercentageCompleted}
            />
          </div>
          {deployState.length > 0 && 
              <div className="deploy-item">Deployer State:  
                <div className="deploy-item__state">
                  {tables.map((table)=>(
                        
                        <div className="deploy-item__state-table">
                          <Table size="md" useZebraStyles={false}>
                            <TableHead>
                              <TableRow>
                                {headers.map((header) => (
                                  <TableHeader id={header.key} key={header}>
                                    {header}
                                  </TableHeader>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {table.map((row) => (
                                <TableRow key={row.id}>
                                  {Object.keys(row)
                                    .filter((key) => key !== 'id')
                                    .map((key) => {
                                      return <TableCell key={key}>{row[key]}</TableCell>;
                                    })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>            
                  ))
                  }
                </div>           
              </div>                
          }
        </div>        
      </>

    )
  }

  return (
    <>
     <div className="wizard-container">
      <div className="wizard-container__page">
        <div className='wizard-container__page-header'>
          <div className='wizard-container__page-header-title'>         
            <h2>Deploy Wizard</h2>
            <div className='wizard-container__page-header-subtitle'>for IBM Cloud Pak</div>                      
          </div>
          { isDeployStart ? null: 
          <div>
            <Button className="wizard-container__page-header-button" onClick={clickPrevious} disabled={currentIndex === 0}>Previous</Button>
            {currentIndex === 4 ?
              <ActionBySelect />
              :
              <Button className="wizard-container__page-header-button" onClick={clickNext} disabled={wizardError}>Next</Button>
            }            
          </div>
          }          
        </div> 
        {loadingDeployStatus && <Loading /> }            
        {
          isDeployStart ? 
            //Deploy Process
            isDeployErr ?
              <InlineNotification className="deploy-error"
                {...errorProps()}        
              />  
              :
              <div>
                { selection!=="Configure" && <DeployStats />}  
                { selection==="Configure" &&  saveConfig  && <InlineNotification className="deploy-error"
                  {...successSaveConfigProps()}        
                  />  
                }
              </div>                       
          :
          //Wizard Process
          <DeployerProgressIndicator />                   
        } 
        {currentIndex === 0 ? <Selection
                            setSelection={setSelection} 
                            setCpdWizardMode={setCpdWizardMode}
                            selection={selection}
                            setCurrentIndex={setCurrentIndex}
                            setConfigDir={setConfigDir}
                            setStatusDir={setStatusDir}
                            setHeaderTitle={setHeaderTitle}
                            headerTitle={headerTitle}
                      >
                      </Selection> : null} 
      
        {currentIndex === 1 ? <Infrastructure
                                    cloudPlatform={cloudPlatform} 
                                    setCloudPlatform={setCloudPlatform} 
                                    IBMCloudSettings={IBMCloudSettings}
                                    setIBMCloudSettings={setIBMCloudSettings}                                      
                                    AWSSettings={AWSSettings}
                                    setAWSSettings={setAWSSettings}
                                    OCPSettings={OCPSettings}
                                    setOCPSettings={setOCPSettings}                                    
                                    setWizardError={setWizardError}
                                    ocLoginErr={ocLoginErr}
                                    configuration={configuration}
                                    setConfiguration={setConfiguration}
                                    locked={locked}
                                    setLocked={setLocked}
                                    isOcLoginCmdInvalid={isOcLoginCmdInvalid}
                                    setOcLoginCmdInvalid={setOcLoginCmdInvalid}
                                    envId={envId}
                                    setEnvId={setEnvId}
                                    checkDeployerStatusErr={checkDeployerStatusErr}
                                    cpdWizardMode={cpdWizardMode}
                                    selection={selection}
                                    registryHostname={registryHostname}
                                    setRegistryHostname={setRegistryHostname}
                                    registryPort={registryPort}
                                    setRegistryPort={setRegistryPort}
                                    registryNS={registryNS}
                                    setRegistryNS={setRegistryNS}
                                    registryUser={registryUser}
                                    setRegistryUser={setRegistryUser}
                                    registryPassword={registryPassword}
                                    setRegistryPassword={setRegistryPassword}
                                    portable={portable}
                                    setPortable={setPortable}
                              >
                              </Infrastructure> : null} 
        {currentIndex === 2 ? <Storage 
                                    cloudPlatform={cloudPlatform} 
                                    setStorage={setStorage} 
                                    storage={storage} 
                                    storagesOptions={storagesOptions} 
                                    setStoragesOptions={setStoragesOptions}
                                    setWizardError={setWizardError}
                                    configuration={configuration}
                                    locked={locked}
                              >                                    
                              </Storage> : null}    
        {currentIndex === 3 ? <CloudPak
                                    entitlementKey={entitlementKey} 
                                    setEntitlementKey={setEntitlementKey}
                                    CPDCartridgesData={CPDCartridgesData}
                                    setCPDCartridgesData={setCPDCartridgesData}
                                    CPICartridgesData={CPICartridgesData}
                                    setCPICartridgesData={setCPICartridgesData}                                    
                                    setWizardError={setWizardError}
                                    configuration={configuration}
                                    locked={locked}
                                    cp4dLicense={cp4dLicense}
                                    cp4iLicense={cp4iLicense}
                                    cp4dVersion={cp4dVersion}
                                    cp4iVersion={cp4iVersion}
                                    setCp4dLicense={setCp4dLicense}
                                    setCp4iLicense={setCp4iLicense}
                                    setCp4dVersion={setCp4dVersion}
                                    setCp4iVersion={setCp4iVersion}
                                    CP4DPlatformCheckBox={CP4DPlatformCheckBox}
                                    CP4IPlatformCheckBox={CP4IPlatformCheckBox}
                                    setCP4DPlatformCheckBox={setCP4DPlatformCheckBox}
                                    setCP4IPlatformCheckBox={setCP4IPlatformCheckBox}
                                    adminPassword={adminPassword}
                                    setAdminPassword={setAdminPassword}
                              >
                              </CloudPak> : null}    
        {currentIndex === 4 ? <Summary 
                                    cloudPlatform={cloudPlatform} 
                                    IBMCloudSettings={IBMCloudSettings}                                                                      
                                    AWSSettings={AWSSettings}
                                    storage={storage} 
                                    CPDCartridgesData={CPDCartridgesData}
                                    setCPDCartridgesData={setCPDCartridgesData}
                                    CPICartridgesData={CPICartridgesData}
                                    setCPICartridgesData={setCPICartridgesData}
                                    configuration={configuration}
                                    locked={locked}
                                    cp4dLicense={cp4dLicense}
                                    cp4iLicense={cp4iLicense}
                                    cp4dVersion={cp4dVersion}
                                    cp4iVersion={cp4iVersion}
                                    envId={envId}
                                    CP4DPlatformCheckBox={CP4DPlatformCheckBox}
                                    CP4IPlatformCheckBox={CP4IPlatformCheckBox}
                                    summaryLoading={summaryLoading}
                                    setSummaryLoading={setSummaryLoading}
                                    configDir={configDir}
                                    statusDir={statusDir}
                                    tempSummaryInfo={tempSummaryInfo}
                                    setTempSummaryInfo={setTempSummaryInfo}
                                    configInvalid={configInvalid}
                                    setConfigInvalid={setConfigInvalid}
                                    showErr={showErr}
                                    setShowErr={setShowErr}
                              >
                              </Summary> : null}       
      </div> 
    </div>
    </>
  )
};

export default Wizard;
  