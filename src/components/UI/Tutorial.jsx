import React, { useState, useEffect, useCallback } from 'react';

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to Botai! 👋',
    content: 'Create your own custom inscribed bowtie in just a few steps. Let\'s get started!',
    position: 'center',
    arrow: null,
    highlight: null
  },
  {
    title: 'Step 1: Enter Your Text',
    content: 'Type your desired text here. Adjust font, size, rotation, and carving depth with the sliders.',
    position: 'right-of-panel',
    arrow: 'left',
    highlight: '.inscription-card'
  },
  {
    title: 'Step 2: Place Your Inscription',
    content: 'Click anywhere on the 3D bowtie to position your text. Drag to rotate the view.',
    position: 'center-of-canvas',
    arrow: 'right',
    highlight: null
  },
  {
    title: 'Step 3: Add More Inscriptions',
    content: 'Want multiple texts? Click the + button to add another inscription.',
    position: 'right-of-panel',
    arrow: 'left',
    highlight: '.add-inscription-btn'
  },
  {
    title: 'Step 4: Inscribe Your Design',
    content: 'Happy with the design? Click "Inscribe" to carve your text into the bowtie.',
    position: 'right-of-panel',
    arrow: 'left',
    highlight: '.inscribe-btn'
  },
  {
    title: 'Step 5: Order Your Bowtie',
    content: 'Enter your email and click "Order Now" to purchase your custom creation!',
    position: 'right-of-panel',
    arrow: 'left',
    highlight: '#order-section'
  }
];

const STORAGE_KEY = 'botai_tutorial_dismissed';

// Custom hook to manage tutorial state
export function useTutorial(isLoading = false) {
  const [currentStep, setCurrentStep] = useState(0);
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showHelpButton, setShowHelpButton] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  });
  const [highlightStyle, setHighlightStyle] = useState({ display: 'none' });

  useEffect(() => {
    if (isLoading) return;
    
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      // Previously dismissed with "never show again" - show button instead
      setShowHelpButton(true);
      setNeverShowAgain(true);
    } else {
      // First time or user unchecked "never show again" - show tutorial
      setIsVisible(true);
    }
  }, [isLoading]);

  const handleShowTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsVisible(true);
    // Keep neverShowAgain as true when reopening from button
  }, []);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    
    if (neverShowAgain) {
      // Save to localStorage and show button
      localStorage.setItem(STORAGE_KEY, 'true');
      setShowHelpButton(true);
    } else {
      // User unchecked "never show again" - clear localStorage and hide button
      localStorage.removeItem(STORAGE_KEY);
      setShowHelpButton(false);
    }
  }, [neverShowAgain]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Position tooltip based on highlighted element
  const updatePositions = useCallback(() => {
    if (!isVisible) return;
    
    const step = TUTORIAL_STEPS[currentStep];
    
    if (step.position === 'center') {
      setTooltipStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      });
      setHighlightStyle({ display: 'none' });
      return;
    }

    if (step.position === 'center-of-canvas') {
      const canvas = document.querySelector('.canvas-container');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        
        setHighlightStyle({ display: 'none' });
        
        if (isMobile) {
          setTooltipStyle({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          });
        } else {
          setTooltipStyle({
            top: `${rect.top + rect.height / 2}px`,
            left: `${rect.left + rect.width / 4}px`,
            transform: 'translate(-100%, -50%)'
          });
        }
      }
      return;
    }

    if (step.highlight) {
      const element = document.querySelector(step.highlight);
      if (element) {
        const rect = element.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        
        setHighlightStyle({
          display: 'block',
          top: `${rect.top - 4}px`,
          left: `${rect.left - 4}px`,
          width: `${rect.width + 8}px`,
          height: `${rect.height + 8}px`
        });
        
        if (isMobile) {
          setTooltipStyle({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          });
        } else if (step.position === 'right-of-panel') {
          const tooltipTop = step.highlight === '#order-section'
            ? rect.top + rect.height / 2
            : Math.max(100, Math.min(window.innerHeight - 350, rect.top + rect.height / 2));
          
          setTooltipStyle({
            top: `${tooltipTop}px`,
            left: `${rect.right + 24}px`,
            transform: 'translateY(-50%)'
          });
        }
      }
    }
  }, [currentStep, isVisible]);

  useEffect(() => {
    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [updatePositions]);

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Help button - only shown when tutorial was dismissed with "never show again"
  const helpButton = showHelpButton && !isVisible ? (
    <button 
      className="tutorial-help-btn"
      onClick={handleShowTutorial}
      title="Show tutorial"
    >
      ?
    </button>
  ) : null;

  // Tutorial overlay
  const overlay = isVisible ? (
    <div className="tutorial-overlay">
      {step.highlight && (
        <div 
          className="tutorial-highlight"
          style={highlightStyle}
        />
      )}
      
      <div 
        className={`tutorial-tooltip ${step.arrow && !isMobile ? `tutorial-tooltip--arrow-${step.arrow}` : ''} ${step.position === 'center' ? 'tutorial-tooltip--center' : ''}`}
        style={tooltipStyle}
      >
        <div className="tutorial-progress">
          {TUTORIAL_STEPS.map((_, index) => (
            <div
              key={index}
              className={`tutorial-dot ${index === currentStep ? 'tutorial-dot--active' : ''} ${index < currentStep ? 'tutorial-dot--completed' : ''}`}
            />
          ))}
        </div>

        <h2 className="tutorial-title">{step.title}</h2>
        <p className="tutorial-content">{step.content}</p>

        <div className="tutorial-buttons">
          <button className="tutorial-btn tutorial-btn--skip" onClick={handleSkip}>
            Skip
          </button>
          <button className="tutorial-btn tutorial-btn--next" onClick={handleNext}>
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>

        <label className="tutorial-checkbox">
          <input
            type="checkbox"
            checked={neverShowAgain}
            onChange={(e) => setNeverShowAgain(e.target.checked)}
          />
          <span>Don't show this again</span>
        </label>
      </div>
    </div>
  ) : null;

  return { overlay, helpButton };
}
