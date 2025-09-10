# Researched Slash - Search All Possible .gov/.edu/.org

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Now-blue?style=for-the-badge)](https://genmnz.github.io/search.org.edu.gov/)

> Instantly search across 50+ academic databases and repositories to find research papers, articles, datasets, and scholarly content in one place.

## 🌟 Overview

Research Hub is a powerful web application that aggregates search results from over 50 trusted academic and research sources including government databases (.gov), educational institutions (.edu), and non-profit organizations (.org). Whether you're a researcher, student, professor, or simply curious about academic content, this tool provides a unified interface to discover scholarly materials from diverse, authoritative sources.

### ✨ Key Features

- **Comprehensive Search**: Query across 50+ academic databases simultaneously
- **Real-time Results**: Instant aggregation from multiple sources with live status updates
- **Flexible Filtering**: Select specific data sources or search all at once
- **Rich Metadata**: Display detailed information including authors, abstracts, DOIs, citations, and more
- **Open Access Detection**: Identify open access materials and closed content
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **No Registration Required**: Free to use with no account needed
- **Privacy-Focused**: All searches performed client-side with no data collection

## 🚀 Quick Start

### For Researchers & Students (Non-Technical)

1. **Visit the Live Site**: Go to [https://genmnz.github.io/search.org.edu.gov/](https://genmnz.github.io/search.org.edu.gov/)
2. **Enter Your Search**: Type your research topic, keywords, or specific paper titles
3. **Customize Sources** (Optional): Click the "Filters" button to select specific databases
4. **Browse Results**: Explore the aggregated results with detailed metadata
5. **Access Content**: Click "View Source" to access the original material

### For Developers (Technical Setup)

```bash
# Clone the repository
git clone https://github.com/genmnz/search.org.edu.gov.git
cd search.org.edu.gov

# Open in browser (no build required)
# Simply open index.html in your web browser
```

## 📚 Supported Data Sources

Research Hub aggregates from the following 50+ trusted academic sources:

### Government & Educational Databases
- **ERIC** - Education Resources Information Center
- **PubMed** - National Library of Medicine biomedical literature
- **Europe PMC** - European life sciences literature
- **NASA OSDR** - NASA Open Science Data Repository
- **NASA Image Search** - NASA image and media database
- **ADS (NASA Astrophysics)** - NASA Astrophysics Data System
- **ClinicalTrials.gov** - Clinical research studies database
- **World Bank Documents** - World Bank research and publications

### Academic Repositories
- **arXiv** - Preprint server for physics, math, computer science
- **Semantic Scholar** - AI-powered academic search engine
- **OpenAlex** - Comprehensive scholarly works database
- **CORE** - Open access research papers aggregator
- **Zenodo** - Research data repository
- **Figshare** - Research outputs repository
- **Dryad** - Research data repository
- **Mendeley Data** - Research data sharing platform

### Library Collections
- **OpenLibrary** - Internet Archive's book database
- **Project Gutenberg** - Free ebooks collection
- **Internet Archive** - Digital library of cultural artifacts
- **HathiTrust** - Digital library partnership
- **Library of Congress** - National library collections
- **LibraryCloud** - Harvard Library collections
- **Google Books** - Book search and preview service
- **Chronicling America** - Historic newspapers

### International & Specialized Databases
- **OpenAIRE** - European open science infrastructure
- **Europeana** - European cultural heritage collections
- **Europeana Newspapers** - Historic European newspapers
- **HAL** - French open archive
- **Trove (NLA)** - National Library of Australia
- **eScholarship (UC)** - University of California publications
- **ESA Open Science Data** - European Space Agency data

### Publisher & Journal Platforms
- **PLOS** - Public Library of Science journals
- **DOAJ** - Directory of Open Access Journals
- **Crossref** - DOI registration agency
- **Unpaywall** - Open access locator
- **DataCite** - Research data citation
- **SHARE** - Open research sharing network
- **INSPIRE HEP** - High-energy physics literature
- **ORCID** - Researcher identifier registry

### Additional Sources
- **JSTOR Open Content** - Academic journal archive (open content)
- **BASE** - Bielefeld Academic Search Engine
- **OSF** - Open Science Framework
- **PubChem** - Chemical compounds database
- **WHO ICTRP** - World Health Organization trials registry

## 🔧 Technical Architecture

### Frontend Stack
- **HTML5** - Semantic markup and accessibility
- **CSS3** - Custom responsive design with modern styling
- **Alpine.js** - Lightweight reactive framework
- **Vanilla JavaScript** - ES6+ with async/await patterns

### Key Components
- **Search Engine**: Debounced search with 500ms delay
- **API Aggregator**: Concurrent requests to multiple endpoints
- **Result Normalizer**: Unified data structure from diverse APIs
- **Error Handling**: Graceful degradation and retry mechanisms
- **Local Storage**: Persistent user preferences and settings

### API Integration Features
- **Rate Limiting**: Built-in retry logic for API limits
- **CORS Handling**: Client-side proxy for cross-origin requests
- **XML Parsing**: Support for XML-based APIs (arXiv, ORCID)
- **Authentication**: API key support where required
- **Data Normalization**: Consistent result format across all sources

## 📊 Usage Statistics

- **Sources Queried**: 50+ academic databases
- **Result Types**: Papers, books, datasets, images, clinical trials
- **Metadata Fields**: Title, authors, abstract, DOI, citations, open access status
- **Response Time**: Typically 2-10 seconds depending on selected sources
- **Caching**: None - fresh results from source APIs

## 🤝 Contributing

We welcome contributions from researchers, developers, and academic communities!

### Ways to Contribute
- **Add New Sources**: Integrate additional academic databases
- **Improve UI/UX**: Enhance the user interface and experience
- **Bug Reports**: Report issues or suggest improvements
- **Documentation**: Help improve this README or add tutorials
- **API Keys**: Provide access to additional APIs (where ethically appropriate)

### Development Guidelines
1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request with detailed description

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Academic Community**: For making research openly accessible
- **API Providers**: For their commitment to open data and interoperability
- **Open Source Libraries**: Alpine.js, and various academic APIs
- **Contributors**: Everyone who helps improve this tool

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/genmnz/search.org.edu.gov/issues)
- **Discussions**: [GitHub Discussions](https://github.com/genmnz/search.org.edu.gov/discussions)
- **Email**: For sensitive inquiries or collaborations

---

**Made with ❤️ for the global research community**

*Empowering discovery through unified academic search*
