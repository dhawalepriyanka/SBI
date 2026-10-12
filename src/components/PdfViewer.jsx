import { useEffect, useRef, useState } from 'react';
import PdfFieldLayer from './PdfFieldLayer';
import PdfMediaLayer from './PdfMediaLayer';

// Pages 1 to 13 of application (Cover + Main Application Form ending with Acknowledgement Receipt)
export const FORM_PAGES = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const PAGE_COUNT = FORM_PAGES.length;

function LazyPdfPage({ displayPage, sourcePage, scale, fitMode, rotation, pageRef, fields, values, onFieldChange, onVisiblePage, photo, signature, mediaActions, readOnly }) {
  const localRef = useRef(null);
  const [active, setActive] = useState(displayPage <= 2);

  useEffect(() => {
    const node = localRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '1200px 0px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = localRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onVisiblePage(displayPage);
    }, { rootMargin: '-32% 0px -58% 0px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisiblePage, displayPage]);

  const setRef = (node) => {
    localRef.current = node;
    pageRef(node);
  };
  const style = fitMode ? undefined : { width: `${612 * scale}px` };

  return <article className="pdf-page" ref={setRef} style={style}>
    {active && <img className="pdf-page-image" src={`/api/form-pages/${sourcePage}?v=seq`} alt={`Official SBI form page ${displayPage}`} draggable="false" />}
    {active && !rotation && <PdfMediaLayer pageNumber={sourcePage} photo={photo} signature={signature} readOnly={readOnly} {...mediaActions} />}
    {active && !rotation && <PdfFieldLayer fields={fields} values={values} onChange={onFieldChange} readOnly={readOnly} />}
    <span className="page-number">Page {displayPage}</span>
  </article>;
}

export default function PdfViewer({ fieldMap, values, photo, signature, mediaActions, page, scale, fitMode, rotation, onPageCount, onVisiblePage, onFieldChange, readOnly = false }) {
  const pageRefs = useRef([]);
  const visiblePageRef = useRef(1);
  const scrollRef = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(1080);

  useEffect(() => onPageCount(PAGE_COUNT), [onPageCount]);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const updateWidth = () => setAvailableWidth(Math.max(280, node.clientWidth - (window.innerWidth < 640 ? 12 : 48)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!page || page === visiblePageRef.current || !pageRefs.current[page - 1]) return;
    pageRefs.current[page - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page]);

  const handleVisiblePage = (pageNumber) => {
    visiblePageRef.current = pageNumber;
    onVisiblePage(pageNumber);
  };
  const pageWidth = fitMode === 'page' ? Math.min(900, availableWidth) : Math.min(1080, availableWidth);

  return <section className="viewer-area" ref={scrollRef}>
    <p className="field-notice neutral">Click a printed box to enter a value. The official PDF template remains secured on the server.</p>
    <div className={fitMode === 'width' ? 'pdf-stack fit-width' : 'pdf-stack'} style={fitMode ? { width: pageWidth } : undefined}>
      {FORM_PAGES.map((sourcePage, index) => {
        const displayPage = index + 1;
        return <LazyPdfPage key={sourcePage} displayPage={displayPage} sourcePage={sourcePage}
          scale={scale} fitMode={fitMode} rotation={rotation}
          fields={fieldMap.pages[String(sourcePage)] || []} values={values} onFieldChange={onFieldChange}
          onVisiblePage={handleVisiblePage} photo={photo} signature={signature} mediaActions={mediaActions}
          readOnly={readOnly} pageRef={(node) => { pageRefs.current[index] = node; }} />;
      })}
    </div>
  </section>;
}
