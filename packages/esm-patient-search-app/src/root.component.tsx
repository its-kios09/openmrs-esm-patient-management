import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PatientSearchPageComponent from './patient-search-page/patient-search-page.component';
import OverViewComponent from './overview-page/overview-page.component';

const PatientSearchRootComponent: React.FC = () => {
    const baseName = window.getOpenmrsSpaBase() + 'home/registration';

  return (
    <BrowserRouter basename={baseName}>
      <Routes>
        <Route path="/" element={<OverViewComponent />} />
      </Routes>
    </BrowserRouter>
  );
};

export default PatientSearchRootComponent;
