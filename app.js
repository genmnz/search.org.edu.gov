async function fetchWithRetry(url, options = {}, retries = 0, delay = 1000) {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

document.addEventListener("alpine:init", () => {
  Alpine.data("searchApp", () => ({
    query: "",
    rawResults: [],
    loading: false,
    error: null,
    searchTimeout: null,
    stats: {},
    selectedProviders: [],
    allProviders: [],

    init() {
      this.allProviders = API_LIST.map((api) => api.name);
      const savedProviders = localStorage.getItem("selectedProviders");
      if (savedProviders) {
        this.selectedProviders = JSON.parse(savedProviders);
      } else {
        this.selectedProviders = [...this.allProviders];
      }

      // Load max results settings
      const savedMaxResults = localStorage.getItem("maxResults");
      if (savedMaxResults) {
        this.maxResults = parseInt(savedMaxResults);
      }

      const savedPerProviderMax = localStorage.getItem("perProviderMax");
      if (savedPerProviderMax) {
        this.perProviderMax = JSON.parse(savedPerProviderMax);
      } else {
        // Initialize with default values
        this.perProviderMax = {};
        this.allProviders.forEach(provider => {
          this.perProviderMax[provider] = this.maxResults;
        });
      }

      // Initialize results shown counter
      this.resultsShown = 50;

      this.$watch("selectedProviders", (value) => {
        localStorage.setItem("selectedProviders", JSON.stringify(value));
      });

      this.$watch("maxResults", (value) => {
        localStorage.setItem("maxResults", value);
        // Update per-provider max if using global setting
        if (!this.usePerProviderMax) {
          this.allProviders.forEach(provider => {
            this.perProviderMax[provider] = value;
          });
          localStorage.setItem("perProviderMax", JSON.stringify(this.perProviderMax));
        }
      });

      this.$watch("perProviderMax", (value) => {
        localStorage.setItem("perProviderMax", JSON.stringify(value));
      }, { deep: true });

      this.$watch("query", (value) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          if (value.trim()) {
            this.search();
          } else {
            this.rawResults = [];
            this.stats = {};
          }
        }, 500);
      });
    },

    selectAllProviders() {
      this.selectedProviders = [...this.allProviders];
    },

    unselectAllProviders() {
      this.selectedProviders = [];
    },

    showMore() {
      this.resultsShown += 50;
    },

    getAuthorText(author, expanded) {
        if (!author) return '';
        const authors = author.split(', ');
        if (authors.length <= 2 || expanded) {
            return author;
        }
        return `${authors.slice(0, 2).join(', ')} <span class="more-authors"></span>`;
    },

    get results() {
      let filteredResults;
      if (this.selectedProviders.length === this.allProviders.length) {
        filteredResults = this.rawResults;
      } else {
        filteredResults = this.rawResults.filter((result) =>
          this.selectedProviders.includes(result.source),
        );
      }
      return filteredResults.slice(0, this.resultsShown);
    },

    get hasMoreResults() {
      let filteredResults;
      if (this.selectedProviders.length === this.allProviders.length) {
        filteredResults = this.rawResults;
      } else {
        filteredResults = this.rawResults.filter((result) =>
          this.selectedProviders.includes(result.source),
        );
      }
      return filteredResults.length > this.resultsShown;
    },

    get sortedProviders() {
      return [...this.allProviders].sort((a, b) => {
        const statA = this.stats[a] || { success: false, count: 0 };
        const statB = this.stats[b] || { success: false, count: 0 };

        // If both have results, sort by count descending
        if (statA.count > 0 && statB.count > 0) {
          return statB.count - statA.count;
        }
        // If one has results and the other doesn't, the one with results comes first
        if (statA.count > 0) return -1;
        if (statB.count > 0) return 1;

        // If both have no results, check success status
        if (statA.success && !statB.success) return -1;
        if (!statA.success && statB.success) return 1;
        
        // If both have the same success and count, maintain original order
        return 0;
      });
    },

    search() {
      this.loading = true;
      this.error = null;
      this.rawResults = [];
      this.stats = {};

      const providersToSearch = API_LIST.filter((api) =>
        this.selectedProviders.includes(api.name),
      );

      if (providersToSearch.length === 0) {
        this.loading = false;
        this.error = "Please select at least one data source.";
        return;
      }

      const searchPromises = providersToSearch.map(api => {
        const promise = this.fetchProvider(api);
        return promise.then(normalized => {
            this.stats[api.name] = { count: normalized.length, success: true };
            if (normalized.length > 0) {
                this.rawResults.push(...normalized);
            }
        }).catch(error => {
            console.error(`Error fetching from ${api.name}:`, error);
            this.stats[api.name] = { count: 0, success: false };
        });
      });

      Promise.allSettled(searchPromises).finally(() => {
        this.loading = false;
        if (this.rawResults.length === 0 && !this.error) {
          this.error = "No results found from any source.";
        }
      });
    },

    async fetchProvider(api) {
        const url = api.getUrl(this.query);
        let options;

        if (api.method === "POST") {
          let headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; AcademicSearchApp/1.0)"
          };
          // Add custom headers if provided by the API
          if (api.getHeaders) {
            headers = { ...headers, ...api.getHeaders() };
          }
          let body = JSON.stringify(api.getBody(this.query));

          options = {
            method: "POST",
            headers: headers,
            body: body,
          };
        } else {
          options = {
            method: api.method || "GET",
            // Add headers for GET requests if provided by the API
            headers: api.getHeaders ? { ...api.getHeaders(), "User-Agent": "Mozilla/5.0 (compatible; AcademicSearchApp/1.0)" } : { "User-Agent": "Mozilla/5.0 (compatible; AcademicSearchApp/1.0)" },
          };
        }

        try {
          const response = await fetchWithRetry(url, options, api.name === "Semantic Scholar" ? 2 : 0);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = api.isXml ? await response.text().then(str => new DOMParser().parseFromString(str, "text/xml")) : await response.json();
          return await api.normalize(data);
        } catch (error) {
          // Handle CORS and network errors gracefully
          if (error.message.includes('CORS') ||
              error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError') ||
              error.name === 'TypeError') {
            console.warn(`CORS or network error for ${api.name}:`, error.message);
            // Return empty array instead of throwing to prevent search from failing completely
            return [];
          }
          throw error;
        }
    },
  }));
});

/**
 * I need to capture all possible but important data and metadata these api ednpoints can ever return
 * only if important, and nicely represeit them in the UI
 * they should be relevent, sortable/filterable later via our UI not here but representable
 */
// --- Unified Placeholders ---
const maxResults = 20;
const page = 1; // For 1-based indexing
const offset = 0; // For 0-based indexing
const lang_en = "en";
const lang_eng = "eng";
const sortByRelevance = "relevance";

// --- API-specific Placeholders ---
const ericFields =
  "title,author,source,publicationdateyear,description,subject,peerreviewed,url,id,educationlevel";
const openlibrarySort = "new";
const unpaywallIsOa = true;
const zenodoType = "publication";
const mostRecent = "mostrecent";
const arxivSortOrder = "descending";
const europeanaReusability = "open";
const europeanaApiKey = "kagnumooka";
const openalexSort = "relevance_score:desc";
const gutenbergSort = "popular";
const gutenbergTopic = "";
const crossrefSort = "score";
const crossrefMailto = "myluvmail@gmail.com";
const semanticScholarFields = "title,authors,year,abstract,url,externalIds";
const osfSort = "-relevance";
const plosApiKey = "YOUR_PLOS_API_KEY"; // User needs to replace this
const plosSort = "score desc";
const shareSort = "_score";
const inspireSort = "relevance";

const API_LIST = [
  {
    name: "ERIC",
    getUrl: (query) =>
      `https://api.ies.ed.gov/eric/?search=${encodeURIComponent(query)}&format=json&rows=${maxResults}&start=${offset}&sort=${sortByRelevance}&fields=${ericFields}`,
    normalize: (data) => {
      if (!data.response || !data.response.docs) {
        console.error("ERIC: Invalid data format", data);
        return [];
      }
      return data.response.docs.map(
        ({
          title = "",
          author,
          publicationDateTime,
          description,
          url,
          id,
          educationLevel,
          peerReviewed,
        }) => ({
          title,
          author: author?.join(", ") || "Unknown",
          year: publicationDateTime
            ? new Date(publicationDateTime).getFullYear()
            : undefined,
          abstract: description || "",
          source: "ERIC",
          link: url,
          identifier: id,
          educationLevel,
          peerReviewed,
        }),
      );
    },
  },
  {
    name: "OpenAIRE",
    getUrl: (query) =>
      `https://api.openaire.eu/search/publications?title=${encodeURIComponent(query)}&format=json&page=${page}`,
    normalize: (data) => {
      const results = data.response?.results?.result;
      if (!Array.isArray(results)) {
        return [];
      }
      return results
        .map((item) => {
          const result = item.metadata?.["oaf:entity"]?.["oaf:result"];
          if (!result) {
            return null;
          }

          const {
            title: titleArray,
            creator,
            pid,
            publisher,
            dateofacceptance,
            resourcetype,
          } = result;

          const title =
            (Array.isArray(titleArray)
              ? titleArray.find((t) => t["@classid"] === "main title")?.["$"] ||
              titleArray[0]?.["$"]
              : titleArray?.["$"]) || "Untitled";

          let author = "Unknown";
          if (creator) {
            if (Array.isArray(creator)) {
              author = creator.map((c) => c["$"]).join(", ");
            } else {
              author = creator["$"];
            }
          }

          const pids = Array.isArray(pid) ? pid : (pid ? [pid] : []);
          const doi = pids.find((id) => id["@classid"] === "doi")?.["$"];
          const link = doi
            ? `https://doi.org/${doi}`
            : result.children?.instance?.[0]?.webresource?.url?.["$"] || "#";

          return {
            title,
            author,
            source: "OpenAIRE",
            link,
            publisher: publisher?.["$"],
            publication_date: dateofacceptance?.["$"],
            abstract: result.description?.["$"] || "",
            type: resourcetype?.["@classname"],
            doi,
            subjects: Array.isArray(result.subject) ? result.subject.map(s => s['$']) : (result.subject?.$ ? [result.subject.$] : []),
            journal: result.journal?.["$"],
            accessRight: result.bestaccessright?.["@classname"],
            language: result.language?.["@classname"],
            _meta: {
              all_pids: result.pid,
              dates: result.relevantdate,
              measures: result.measure,
              datainfo: result.datainfo,
              children: result.children,
              collectedfrom: result.collectedfrom,
            },
          };
        })
        .filter((item) => item !== null);
    },
  },

  {
    name: "OpenLibrary",
    getUrl: (query) =>
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${maxResults}&sort=${openlibrarySort}&lang=${lang_eng}`,
    normalize: (data) =>
      data.docs?.map((doc) => ({
        title: doc.title || "Untitled",
        author: doc.author_name?.join(", ") || "Unknown",
        source: "OpenLibrary",
        link: doc.key ? `https://openlibrary.org${doc.key}` : "#",
        image: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : undefined,
        year: doc.first_publish_year,
        publisher: doc.publisher?.[0],
        subjects: doc.subject,
        isbn: doc.isbn?.[0],
      })) || [],
  },
  {
    name: "Internet Archive",
    getUrl: (query) =>
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&output=json&rows=${maxResults}&page=${page}`,
    normalize: (data) =>
      data.response?.docs?.map((item) => ({
        title: item.title || "Untitled",
        author: item.creator || "Unknown",
        source: "Internet Archive",
        link: `https://archive.org/details/${item.identifier}`,
        image: `https://archive.org/services/img/${item.identifier}`,
        description: item.description,
        publication_date: item.publicdate,
        publisher: typeof item.publisher === "string" ? item.publisher : undefined,
        type: item.mediatype,
        subjects: item.subject,
      })) || [],
  },
  {
    name: "Unpaywall",
    getUrl: (query) =>
      `https://api.unpaywall.org/v2/search?query=${encodeURIComponent(query)}&email=${crossrefMailto}`,
    normalize: (data) => {
      if (!Array.isArray(data.results)) {
        console.error("Unpaywall: 'results' is not an array", data);
        return [];
      }
      return data.results
        .map((item) => {
          const response = item.response;
          if (!response) return null;

          return {
            title: response.title || "Untitled",
            author:
              response.z_authors
                ?.map((a) => `${a.given || ""} ${a.family || ""}`.trim())
                .join(", ") || "Unknown",
            source: "Unpaywall",
            link: response.doi_url || response.best_oa_location?.url || "#",
            year: response.year,
            publisher: response.publisher,
            type: response.genre,
            doi: response.doi,
            is_oa: response.is_oa,
            oa_status: response.oa_status,
            journal_name: response.journal_name,
            published_date: response.published_date,
            best_oa_location: response.best_oa_location,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "Zenodo",
    getUrl: (query) =>
      `https://zenodo.org/api/records?q=${encodeURIComponent(query)}&sort=${mostRecent}&page=${page}&size=${maxResults}&type=${zenodoType}`,
    normalize: (data) =>
      data.hits?.hits?.map((item) => ({
        title: item.metadata.title || "Untitled",
        author:
          item.metadata.creators?.map((c) => c.name).join(", ") || "Unknown",
        source: "Zenodo",
        link: item.links.self_html || "#",
        image: item.links?.thumbnails?.["750"],
        description: item.metadata.description,
        publisher: item.metadata.imprint?.publisher,
        publication_date: item.metadata.publication_date,
        type: item.metadata.resource_type?.title,
        keywords: item.metadata.keywords,
      })) || [],
  },
  {
    name: "arXiv",
    getUrl: (query) =>
      `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=${offset}&max_results=${maxResults}&sortBy=${sortByRelevance}&sortOrder=${arxivSortOrder}`,
    isXml: true,
    normalize: (xmlDoc) => {
      const entries = Array.from(xmlDoc.querySelectorAll("entry"));
      return entries.map((entry) => ({
        title: entry.querySelector("title")?.textContent || "Untitled",
        author:
          Array.from(entry.querySelectorAll("author > name"))
            .map((el) => el.textContent)
            .join(", ") || "Unknown",
        source: "arXiv",
        link: entry.querySelector("id")?.textContent || "#",
        image: entry
          .querySelector('link[rel="preview"][type="image/jpeg"]')
          ?.getAttribute("href"),
        description: entry.querySelector("summary")?.textContent.trim(),
        publication_date: entry.querySelector("published")?.textContent,
        updated_date: entry.querySelector("updated")?.textContent,
      }));
    },
  },
  {
    name: "CORE",
    getUrl: (query) =>
      `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${maxResults}`,
    normalize: (data) =>
      data.results?.map((item) => ({
        title: item.title || "Untitled",
        author: item.authors?.map((a) => a.name).join(", ") || "Unknown",
        source: "CORE",
        link:
          item.links?.find((l) => l.type === "display")?.url ||
          item.downloadUrl ||
          "#",
        image: item.links?.find((l) => l.type === "thumbnail_l")?.url,
        description: item.abstract,
        publisher: (item.publisher || "N/A").replace(/'/g, ""),
        publication_date: item.publishedDate,
        doi: item.doi,
        year: item.yearPublished,
        topics: item.fieldOfStudy ? [item.fieldOfStudy] : item.subjects || [],
        documentType: item.documentType,
        language: item.language?.name,
        journal: item.journals?.[0]?.title,
        citationCount: item.citationCount,
      })) || [],
  },
  {
    name: "Europeana",
    getUrl: (query) =>
      `https://api.europeana.eu/record/v2/search.json?wskey=${europeanaApiKey}&query=${encodeURIComponent(query)}&rows=${maxResults}&start=${page}&reusability=${europeanaReusability}`,
    normalize: (data) =>
      data.items?.map((item) => ({
        title: Array.isArray(item.title)
          ? item.title[0]
          : item.dcTitleLangAware?.def?.[0] ||
          item.dcTitleLangAware?.en?.[0] ||
          "Untitled",
        author: item.dcCreator?.[0] || "Unknown",
        source: "Europeana",
        link: item.guid || "#",
        image: item.edmPreview?.[0],
        description: Array.isArray(item.dcDescription)
          ? item.dcDescription[0]
          : item.dcDescriptionLangAware?.def?.[0] ||
          item.dcDescriptionLangAware?.da?.[0] ||
          "",
        publisher: item.dataProvider?.[0],
        year: item.year?.[0] || item.edmTimespanLabelLangAware?.zxx?.[0],
        type: item.type,
        score: item.score,
        country: item.country?.[0],
        language: item.language?.[0],
        rights: item.rights?.[0],
      })) || [],
  },
  {
    name: "OpenAlex",
    getUrl: (query) =>
      `https://api.openalex.org/works?filter=display_name.search:${encodeURIComponent(query)}&per-page=${maxResults}&page=${page}&sort=${openalexSort}`,
    normalize: (data) =>
      data.results?.map((item) => ({
        title: item.title || "Untitled",
        author:
          item.authorships?.map((a) => a.author.display_name).join(", ") ||
          "Unknown",
        source: "OpenAlex",
        link: item.doi || item.primary_location?.landing_page_url || "#",
        publication_date: item.publication_date,
        year: item.publication_year,
        type: item.type,
        publisher: item.primary_location?.source?.display_name,
        is_oa: item.open_access?.is_oa,
        oa_status: item.open_access?.oa_status,
        oa_url: item.open_access?.oa_url,
        relevance_score: item.relevance_score,
        cited_by_count: item.cited_by_count,
        journal: item.primary_location?.source?.display_name,
        issn: item.primary_location?.source?.issn_l,
        volume: item.biblio?.volume,
        issue: item.biblio?.issue,
        first_page: item.biblio?.first_page,
        last_page: item.biblio?.last_page,
        topics: item.topics?.map((t) => t.display_name),
        keywords: item.keywords?.map((k) => k.display_name),
        concepts: item.concepts?.map((c) => c.display_name),
        mesh: item.mesh?.map((m) => m.descriptor_name),
        best_oa_location: item.best_oa_location,
      })) || [],
  },
  {
    name: "Project Gutenberg",
    getUrl: (query) =>
      `https://gutendex.com/books?search=${encodeURIComponent(query)}&sort=${gutenbergSort}&languages=${lang_en}&topic=${gutenbergTopic}`,
    normalize: (data) => {
      if (!data.results || !Array.isArray(data.results)) {
        console.log("Invalid Gutendex response format");
        return [];
      }
      return data.results.map((item) => ({
        title: item.title || "Untitled Book",
        author:
          item.authors?.map((author) => author.name).join(", ") ||
          "Unknown Author",
        year: item.copyright,
        abstract: `${item.subjects?.join(", ") || "Classic literature from Project Gutenberg"}`,
        source: "Project Gutenberg",
        link:
          item.formats?.["text/html"] ||
          item.formats?.["application/pdf"] ||
          `https://www.gutenberg.org/ebooks/${item.id}`,
        image: item.formats?.["image/jpeg"],
        fullTextUrl:
          item.formats?.["application/pdf"] ||
          item.formats?.["text/plain"] ||
          item.formats?.["text/html"],
      }));
    },
  },
  {
    name: "Crossref",
    getUrl: (query) =>
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&select=DOI,title,author,published-print,abstract&rows=${maxResults}&sort=${crossrefSort}&mailto=${crossrefMailto}`,
    normalize: (data) => {
      if (
        !data.message ||
        !data.message.items ||
        !Array.isArray(data.message.items)
      ) {
        console.log("Invalid Crossref response format");
        return [];
      }
      return data.message.items.map((item) => ({
        title: item.title?.[0] || "Untitled Publication",
        author:
          item.author
            ?.map((author) =>
              `${author.given || ""} ${author.family || ""}`.trim(),
            )
            .join(", ") || "Unknown Author",
        year: item["published-print"]?.["date-parts"]?.[0]?.[0],
        doi: item.DOI,
        abstract: item.abstract || "No abstract available",
        source: "Crossref",
        link: item.DOI ? `https://doi.org/${item.DOI}` : "#",
        image: item.DOI
          ? `https://zenodo.org/badge/DOI/${item.DOI}.svg`
          : undefined,
      }));
    },
  },
  {
    name: "PubMed",
    getUrl: (query) =>
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}&sort=${sortByRelevance}`,
    normalize: async (data) => {
      try {
        const ids = data.esearchresult?.idlist;
        if (!ids || ids.length === 0) {
          return [];
        }
        const detailsUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
        const detailsResponse = await fetchWithRetry(detailsUrl);
        const details = await detailsResponse.json();
        if (!details.result) {
          return [];
        }
        return Object.values(details.result)
          .filter((item) => item && item.uid)
          .map((item) => ({
            title: item.title || "",
            author:
              item.authors?.map((author) => author.name).join(", ") ||
              "Unknown",
            year: item.pubdate
              ? new Date(item.pubdate).getFullYear()
              : undefined,
            abstract: item.abstract || "",
            source: "PubMed",
            link: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}`,
            doi: item.elocationid?.replace("doi: ", ""),
            image:
              "https://cdn.ncbi.nlm.nih.gov/pubmed/persistent/pubmed-meta-image-v2.jpg",
          }));
      } catch (error) {
        console.error("PubMed search failed:", error);
        return [];
      }
    },
  },
  {
    name: "Europe PMC",
    getUrl: (query) =>
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${maxResults}`,
    normalize: (data) => {
      if (!data.resultList || !Array.isArray(data.resultList.result)) {
        return [];
      }
      return data.resultList.result.map((item) => {
        const doi = item.doi;
        return {
          title: item.title || "Untitled",
          author: item.authorString || "Unknown",
          source: "Europe PMC",
          link: `https://europepmc.org/article/${item.source}/${item.id}`,
          publisher: item.journalTitle,
          year: item.pubYear,
          publication_date: item.firstPublicationDate,
          doi: doi,
          image: doi ? `https://zenodo.org/badge/DOI/${doi}.svg` : undefined,
          pmid: item.pmid,
          pmcid: item.pmcid,
          journal_title: item.journalTitle,
          journal_volume: item.journalVolume,
          journal_issue: item.issue,
          page_info: item.pageInfo,
          pub_type: item.pubType,
          is_open_access: item.isOpenAccess === "Y",
          cited_by_count: item.citedByCount,
        };
      });
    },
  },
  {
    name: "DataCite",
    getUrl: (query) =>
      `https://api.datacite.org/dois?query=${encodeURIComponent(query)}&sort=-updated&publisher=true&affiliation=true&page[size]=${maxResults}&page[number]=${page}`,
    normalize: (data) =>
      data.data
        ?.map((item) => {
          const attributes = item.attributes;
          if (!attributes) return null;

          const description =
            attributes.descriptions?.find(
              (d) => d.descriptionType === "Abstract",
            )?.description ||
            attributes.descriptions?.[0]?.description ||
            "";

          return {
            title: attributes.titles?.[0]?.title || "Untitled",
            author:
              attributes.creators?.map((c) => c.name).join(", ") || "Unknown",
            source: "DataCite",
            link:
              attributes.url ||
              (attributes.doi ? `https://doi.org/${attributes.doi}` : "#"),
            description: description,
            publisher: attributes.publisher?.name || (typeof attributes.publisher === 'string' ? attributes.publisher : undefined),
            year: attributes.publicationYear,
            type: attributes.types?.resourceTypeGeneral,
            subjects: attributes.subjects?.map((s) => s.subject),
            contributors: attributes.contributors?.map(
              (c) => `${c.name} (${c.contributorType})`,
            ),
            rights: attributes.rightsList?.[0]?.rights,
            _meta: {
              doi: attributes.doi,
              formats: attributes.formats,
              dates: attributes.dates,
              language: attributes.language,
              relatedIdentifiers: attributes.relatedIdentifiers,
              viewCount: attributes.viewCount,
              downloadCount: attributes.downloadCount,
              citationCount: attributes.citationCount,
            },
          };
        })
        .filter(Boolean) || [],
  },
  {
    name: "DOAJ",
    getUrl: (query) =>
      `https://doaj.org/api/v2/search/articles/${encodeURIComponent(query)}?page=${page}&pageSize=${maxResults}`,
    normalize: (data) => {
      if (!data.results || !Array.isArray(data.results)) {
        console.log("Invalid DOAJ response format");
        return [];
      }
      return data.results
        .map((item) => {
          const bibjson = item.bibjson;
          if (!bibjson) return null;

          const doi = bibjson.identifier?.find((id) => id.type === "doi")?.id;
          const publisher = bibjson.journal?.publisher;
          return {
            title: bibjson.title || "",
            author:
              bibjson.author
                ?.map(
                  (author) =>
                    `${author.name}${author.affiliation ? ` (${author.affiliation})` : ""}`,
                )
                .join(", ") || "Unknown",
            year: bibjson.year,
            abstract: bibjson.abstract || "",
            source: "DOAJ",
            link:
              bibjson.link?.[0]?.url || (doi ? `https://doi.org/${doi}` : "#"),
            doi: doi,
            image: doi ? `https://zenodo.org/badge/DOI/${doi}.svg` : undefined,
            keywords: (bibjson.keywords || []).map(k => typeof k === 'object' ? k.term : k),
            publisher: typeof publisher === "string" ? publisher : publisher?.name,
            journal: bibjson.journal?.title,
            subjects: (bibjson.subject || []).map((s) => s.term),
            start_page: bibjson.start_page,
            end_page: bibjson.end_page,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "PLOS",
    getUrl: (query) =>
      `https://api.plos.org/search?q=title:"${encodeURIComponent(query)}"&wt=json&api_key=${plosApiKey}&rows=${maxResults}&sort=${plosSort}`,
    normalize: (data) =>
      data.response?.docs?.map((doc) => ({
        title: doc.title_display || "Untitled",
        author: doc.author_display?.join(", ") || "Unknown",
        source: "PLOS",
        link: doc.id ? `https://doi.org/${doc.id}` : "#",
        publication_date: doc.publication_date,
        type: doc.article_type,
        publisher: doc.journal,
      })) || [],
  },
  {
    name: "SHARE",
    getUrl: (query) =>
      `https://share.osf.io/api/v2/search/creativeworks/_search?q=${encodeURIComponent(query)}&size=${maxResults}&from=${offset}&sort=${shareSort}`,
    normalize: (data) =>
      data.hits?.hits?.map((item) => ({
        title: item._source.title || "Untitled",
        author:
          item._source.contributors
            ?.map((c) => c.name)
            .filter(Boolean)
            .join(", ") || "Unknown",
        year: item._source.date_published
          ? new Date(item._source.date_published).getFullYear()
          : undefined,
        description: item._source.description || "",
        source: "SHARE",
        link: item._source.identifiers?.[0] || "#",
        tags: item._source.tags,
        type: item._source.type,
      })) || [],
  },
  {
    name: "INSPIRE HEP",
    getUrl: (query) =>
      `https://inspirehep.net/api/literature?q=${encodeURIComponent(query)}&size=${maxResults}&page=${page}&sort=${inspireSort}`,
    normalize: (data) =>
      data.hits?.hits?.map((item) => ({
        title: item.metadata.titles?.[0]?.title || "",
        author:
          item.metadata.authors?.map((author) => author.full_name).join(", ") ||
          "Unknown",
        year: item.metadata.earliest_date
          ? new Date(item.metadata.earliest_date).getFullYear()
          : undefined,
        abstract: item.metadata.abstracts?.[0]?.value || "",
        source: "INSPIRE HEP",
        link:
          item.metadata.urls?.[0]?.value ||
          (item.metadata.dois?.[0]?.value
            ? `https://doi.org/${item.metadata.dois[0].value}`
            : "#"),
        doi: item.metadata.dois?.[0]?.value,
        arxivId: item.metadata.arxiv_eprints?.[0]?.value,
        citationCount: item.metadata.citation_count,
      })) || [],
  },
  {
    name: "LibraryCloud",
    getUrl: (query) =>
      `https://api.lib.harvard.edu/v2/items.json?q=${encodeURIComponent(query)}&limit=${maxResults}`,
    normalize: (data) => {
      if (!data.items || !data.items.mods) {
        return [];
      }
      return data.items.mods.map((item) => {
        let authors = "Unknown";
        if (item.name) {
            const nameArray = Array.isArray(item.name) ? item.name : [item.name];
            const authorList = nameArray.map(n => {
                if (!n || !n.namePart) return null;
                const namePart = Array.isArray(n.namePart) ? n.namePart.find(p => typeof p === 'string') : n.namePart;
                return (typeof namePart === 'string') ? namePart : null;
            }).filter(Boolean);
            if (authorList.length > 0) {
                authors = [...new Set(authorList)].join(', ');
            }
        }

        let year;
        let publisher;
        if (item.originInfo) {
            const originInfos = Array.isArray(item.originInfo) ? item.originInfo : [item.originInfo];
            for (const oi of originInfos) {
                if (oi && !publisher && oi.publisher) {
                    publisher = oi.publisher;
                }
                if (oi && !year && oi.dateIssued) {
                    let issued = Array.isArray(oi.dateIssued) ? oi.dateIssued[0] : oi.dateIssued;
                    if (typeof issued === 'string' || typeof issued === 'number') {
                        year = String(issued).match(/\d{4}/)?.[0];
                    } else if (issued && issued['#text']) {
                        year = String(issued['#text']).match(/\d{4}/)?.[0];
                    }
                }
                if (year && publisher) break;
            }
        }

        const abstract = item.abstract?.['#text'] || "";

        let link = "#";
        if (item.relatedItem) {
            const relatedItems = Array.isArray(item.relatedItem) ? item.relatedItem : [item.relatedItem];
            const hollisRecord = relatedItems.find(ri => ri && ri['@otherType'] === 'HOLLIS record');
            if (hollisRecord && hollisRecord.location && hollisRecord.location.url) {
                link = hollisRecord.location.url;
            }
        }

        return {
          title: item.titleInfo?.title || "Untitled",
          author: authors,
          year: year,
          abstract: abstract,
          source: "LibraryCloud",
          link: link,
          publisher: publisher,
        };
      });
    },
  },
  {
    name: "Google Books",
    getUrl: (query) =>
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&startIndex=${offset}`,
    normalize: (data) =>
      data.items?.map((item) => ({
        title: item.volumeInfo.title || "Untitled",
        author: item.volumeInfo.authors?.join(", ") || "Unknown",
        source: "Google Books",
        link: item.volumeInfo.infoLink,
        image: item.volumeInfo.imageLinks?.thumbnail,
        year: item.volumeInfo.publishedDate ? new Date(item.volumeInfo.publishedDate).getFullYear() : undefined,
        publisher: item.volumeInfo.publisher,
        description: item.volumeInfo.description,
        subjects: item.volumeInfo.categories,
      })) || [],
  },
  {
    name: "NASA Image Search",
    getUrl: (query) =>
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`,
    normalize: (data) =>
      data.collection?.items?.map((item) => ({
        title: item.data?.[0]?.title || "Untitled",
        author: item.data?.[0]?.photographer || "Unknown",
        source: "NASA",
        link: item.links?.[0]?.href,
        image: item.links?.[0]?.href,
        description: item.data?.[0]?.description,
        year: item.data?.[0]?.date_created ? new Date(item.data[0].date_created).getFullYear() : undefined,
      })) || [],
  },
  {
    name: "ORCID",
    isXml: true,
    getUrl: (q) =>
      `https://pub.orcid.org/v3.0/search/?q=${encodeURIComponent(q)}&start=0&rows=${maxResults}`,
    normalize: (xmlDoc) => {
        const results = Array.from(xmlDoc.querySelectorAll("result"));
        return results.map((result) => {
            const orcidId = result.querySelector("path")?.textContent;
            const uri = result.querySelector("uri")?.textContent;
            return {
                title: `ORCID Profile: ${orcidId || 'N/A'}`,
                author: orcidId || "Unknown",
                source: "ORCID",
                link: uri,
            };
        });
    },
  },

  {
    name: "HAL",
    getUrl: (q) =>
      `https://api.archives-ouvertes.fr/search/?q=${encodeURIComponent(q)}&wt=json&rows=${maxResults}`,
    normalize: (data) =>
      data.response?.docs?.map((d) => ({
        title: d.label_s || "Untitled",
        author: "Unknown",
        year: undefined,
        abstract: "",
        source: "HAL",
        link: d.uri_s,
        doi: undefined,
        pdf_url: undefined,
      })) || [],
  },
  {
    name: "Europeana Newspapers",
    getUrl: (q) => `https://api.europeana.eu/record/v2/search.json?wskey=${europeanaApiKey}&query=${encodeURIComponent(q)}&qf=type:TEXT&rows=${maxResults}`,
    normalize: (data) =>
        data.items?.map((item) => ({
            title: Array.isArray(item.title) ? item.title[0] : "Untitled",
            author: item.dcCreator?.[0] || "Unknown",
            source: "Europeana Newspapers",
            link: item.guid || "#",
            image: item.edmPreview?.[0],
            description: Array.isArray(item.dcDescription) ? item.dcDescription[0] : "",
            publisher: item.dataProvider?.[0],
            year: item.year?.[0],
        })) || [],
  },
  // { for chemical compounds, not publications
  //     name: "PubChem",
  //     getUrl: (q) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/synonyms/JSON`,
  //     normalize: (data) => {
  //         // This endpoint returns synonyms, not publication data.
  //         // A more complex workflow would be needed to get associated publications.
  //         return [];
  //     }
  // },
  {
    name: "Semantic Scholar",
    // API key can be set as an environment variable for higher rate limits
    getUrl: (query) => {
      // Add API key if available in environment
      const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
      const headers = apiKey ? { 'x-api-key': apiKey } : {};
      
      return `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&offset=${offset}&fields=${semanticScholarFields}`;
    },
    // Add headers option for API key authentication
    method: "GET",
    getHeaders: () => {
      const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
      return apiKey ? { 'x-api-key': apiKey } : {};
    },
    normalize: (data) => {
      if (!data.data || !Array.isArray(data.data)) {
        console.log("Invalid Semantic Scholar response format");
        return [];
      }
      return data.data.map((paper) => ({
        title: paper.title || "Untitled Paper",
        author:
          paper.authors
            ?.map((author) => author.name || "Unknown Author")
            .join(", ") || "Unknown Author",
        year: paper.year || new Date().getFullYear(),
        abstract: paper.abstract || "No abstract available",
        source: "Semantic Scholar",
        link:
          paper.url ||
          (paper.externalIds?.DOI
            ? `https://doi.org/${paper.externalIds.DOI}`
            : "#"),
        doi: paper.externalIds?.DOI,
      }));
    },
  },
  {
    name: "BASE",
    // BASE API requires IP whitelisting and follows OAI-PMH protocol
    // Documentation: https://www.base-search.net/about/en/about_develop.php
    getUrl: (query) =>
      `https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?func=PerformSearch&query=${encodeURIComponent(query)}&format=json&hits=${maxResults}&offset=${offset}`,
    method: "GET",
    normalize: (data) => {
      // Check if data has the expected structure
      if (!data || !data.response || !Array.isArray(data.response.docs)) {
        console.error("BASE: Invalid data format", data);
        return [];
      }
      
      return data.response.docs.map((item) => ({
        title: item.dctitle?.[0] || "Untitled",
        author: item.dccreator?.join(", ") || "Unknown",
        source: "BASE",
        link: item.dclink || item.dcidentifier || "#",
        description: item.dcdescription?.join(" "),
        publisher: item.dcpublisher?.join(", "),
        publication_date: item.dcdate?.join(", "),
        type: item.dctype?.join(", "),
        subjects: item.dcsubject,
        language: item.dclanguage?.[0],
        repository: item.dcrepository,
      })) || [];
    },
  },
  {
    name: "Figshare",
    method: "POST",
    // Figshare API v2 documentation: https://docs.figshare.com/
    // Authentication can be done via OAuth2 or personal tokens
    getUrl: (query) => `https://api.figshare.com/v2/articles/search`,
    getHeaders: () => {
      return { 'Content-Type': 'application/json' };
    },
    getBody: (query) => ({
      search_for: query,
      page: 1,

    }),
    normalize: (data) => {
      // Check if data is an array
      if (!Array.isArray(data)) {
        console.error("Figshare: Invalid data format", data);
        return [];
      }

      return data.map((item) => ({
        title: item.title || "Untitled",
        author: item.authors?.map((a) => a.full_name).join(", ") || "Unknown", // Try to get authors if available
        source: "Figshare",
        link: item.url_public_html || `https://figshare.com/articles/${encodeURIComponent(item.title)}/${item.id}`,
        image: item.thumb,
        doi: item.doi,
        publication_date: item.published_date,
        type: item.defined_type_name,
        resourceTitle: item.resource_title,
        resourceDoi: item.resource_doi,
        year: item.published_date
          ? new Date(item.published_date).getFullYear()
          : undefined,
        description:
          item.resource_title !== item.title
            ? item.resource_title
            : item.description,
      }));
    },
  },
  {
    name: "OSF",
    getUrl: (query) =>
      `https://api.osf.io/v2/nodes/?filter[title][icontains]=${encodeURIComponent(query)}&page[size]=${maxResults}&page=${page}`,
    normalize: (data) => {
      if (!data.data) return [];
      return data.data.map((item) => ({
        title: item.attributes?.title || "Untitled",
        author: "See Contributors",
        source: "OSF",
        link: item.links?.html || "#",
        image: item.links?.html ? `${item.links.html}osfstorage/` : undefined,
        description: item.attributes?.description,
        publication_date: item.attributes?.date_created,
        year: item.attributes?.date_created
          ? new Date(item.attributes.date_created).getFullYear()
          : undefined,
        type: item.attributes?.category,
        tags: item.attributes?.tags,
        subjects: item.attributes?.subjects
          ?.map((subjectArray) => subjectArray[0]?.text)
          .filter(Boolean),
        license: item.attributes?.node_license?.copyright_holders?.join(", "),
        public: item.attributes?.public,
      }));
    },
  },
  {
    name: "Chronicling America",
    getUrl: (query) =>
      `https://chroniclingamerica.loc.gov/search/pages/results/?andtext=${encodeURIComponent(query)}&rows=${maxResults}&format=json`,
    normalize: (data) =>
      data.items?.map((item) => ({
        title: item.title || "Untitled",
        author: item.subject?.join(", "), // No author field, using subject
        source: "Chronicling America",
        link: item.id,
        year: item.date ? new Date(item.date).getFullYear() : undefined,
        publisher: typeof item.publisher === "string" ? item.publisher : undefined,
        description: item.ocr_eng,
        subjects: item.subject,
      })) || [],
  },
  {
    name: "NASA OSDR",
    // Using the Study Dataset Search API from https://osdr.nasa.gov/docs/data-access/data-api/
    getUrl: (query) =>
      `https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(query)}&size=${maxResults}&from=${offset}`,
    // NOTE: The response structure for this API is not fully documented.
    // This normalization is based on conventions of similar search APIs (e.g., Elasticsearch)
    // and the fields listed in the API documentation's "Filter Field" table.
    normalize: (data) => {
      if (!data.hits || !data.hits.hits) {
        return [];
      }
      return data.hits.hits.map((hit) => {
        const source = hit._source;
        if (!source) return null;

        const releaseDate = source["Study Public Release Date"];
        const year = releaseDate
          ? new Date(parseInt(releaseDate) * 1000).getFullYear()
          : undefined;

        const accession = source["Accession"];
        // Constructing a link to the study page, which is a guess based on site structure.
        const link = accession
          ? `https://osdr.nasa.gov/bio/repo/data/studies/${accession}`
          : "#";

        return {
          title: source["Study Title"] || "Untitled",
          author: source["Study Publication Author List"] || "Unknown",
          source: "NASA OSDR",
          link: link,
          year: year,
          description: source["Study Description"] || "",
          publisher: source["Managing NASA Center"],
          subjects: [source["organism"], source["Study Assay Measurement Type"]].filter(Boolean),
        };
      }).filter(Boolean);
    },
  },
  {
    name: "ESA Open Science Data",
    // OData protocol, might be slow or have specific query syntax.
    getUrl: (query) =>
      `https://opensciencedata.esa.int/odata/v1/Products?$filter=contains(Name,'${encodeURIComponent(query)}')&$top=${maxResults}`,
    normalize: (data) =>
      data.value?.map((item) => ({
        title: item.Name || "Untitled",
        source: "ESA Open Science Data",
        link: `https://opensciencedata.esa.int/odata/v1/Products('${item.Id}')`,
        year: item.CreationDate ? new Date(item.CreationDate).getFullYear() : undefined,
        description: item.Name, // No separate description
      })) || [],
  },
  {
    name: "Library of Congress",
    getUrl: (query) =>
      `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=${maxResults}`,
    normalize: (data) =>
      data.results?.map((item) => ({
        title: item.title || "Untitled",
        author: item.creator?.join(", ") || "Unknown",
        source: "Library of Congress",
        link: item.url,
        image: item.image_url?.[0],
        description: item.description?.join(" "),
        subjects: item.subject_headings,
      })) || [],
  },
  {
    name: "JSTOR Open Content",
    getUrl: (q) =>
      `https://www.jstor.org/api/labs-search-service/open/search?query=${encodeURIComponent(q)}&page=1&limit=${maxResults}`,
    normalize: (data) =>
      data.results?.map((d) => ({
        title: d.title || "Untitled",
        author: d.author?.join(", ") || "Unknown",
        year: d.published_year,
        abstract: d.snippet?.[0] || "",
        source: "JSTOR Open Content",
        link: `https://www.jstor.org/stable/${d.id}`,
        doi: d.doi,
      })) || [],
  },
  {
    name: "Dryad",
    getUrl: (q) =>
      `https://datadryad.org/api/v2/search?query=${encodeURIComponent(q)}&per_page=${maxResults}`,
    normalize: (data) =>
      data._embedded?.['stash:datasets']?.map((d) => ({
        title: d.title || "Untitled",
        author: d.authors?.map(a => `${a.firstName} ${a.lastName}`.trim()).join(", ") || "Unknown",
        year: d.publicationDate?.slice(0, 4),
        abstract: d.abstract || "",
        source: "Dryad",
        link: d.sharingLink || (d._links?.self?.href ? `https://datadryad.org${d._links.self.href}` : null),
        doi: d.identifier,
      })) || [],
  },
  {
    name: "Mendeley Data",
    getUrl: (q) =>
      `https://data.mendeley.com/api/datasets?query=${encodeURIComponent(q)}&limit=${maxResults}`,
    normalize: (data) =>
      data.results?.map((d) => ({
        title: d.name || "Untitled",
        author: d.contributors?.map(c => `${c.first_name} ${c.last_name}`).join(", ") || "Unknown",
        year: d.publish_date ? new Date(d.publish_date).getFullYear() : undefined,
        abstract: d.description || "",
        source: "Mendeley Data",
        link: d.doi ? `https://data.mendeley.com/datasets/${d.id}` : null,
        doi: d.doi?.id,
      })) || [],
  },
  {
    name: "eScholarship (UC)",
    getUrl: (q) => `https://escholarship.org/api/1/seo/search/?q=${encodeURIComponent(q)}&rows=${maxResults}`,
    normalize: (data) =>
        data.results?.docs?.map((d) => ({
            title: d.title || "Untitled",
            author: d.author?.join(", ") || "Unknown",
            year: d.publication_date?.slice(0, 4),
            abstract: d.abstract || "",
            source: "eScholarship (UC)",
            link: d.id ? `https://escholarship.org/uc/item/${d.id}` : null,
        })) || [],
  },
  {
    name: "HathiTrust",
    getUrl: (q) => `https://catalog.hathitrust.org/api/v1/search?q=${encodeURIComponent(q)}&set=any&format=json`,
    normalize: (data) => {
        if (!data.records) {
            return [];
        }
        return Object.values(data.records).map((item) => ({
            title: item.titles?.[0] || "Untitled",
            author: item.authors?.join(", ") || "Unknown",
            year: item.publishDates?.[0],
            source: "HathiTrust",
            link: item.recordURL,
        }));
    }
  },
  {
    name: "Trove (NLA)",
    getUrl: (q) => `https://api.trove.nla.gov.au/v2/result?q=${encodeURIComponent(q)}&zone=newspaper&encoding=json&key=YOUR_KEY`,
    normalize: (data) =>
        data.response?.zone?.[0]?.records?.article?.map((a) => ({
            title: a.heading || "Untitled",
            author: a.author || "Unknown",
            year: a.date?.slice(0, 4),
            abstract: a.snippet || "",
            source: "Trove (NLA)",
            link: a.troveUrl,
        })) || [],
  },
  {
    name: "ADS (NASA Astrophysics)",
    getUrl: (q) => `https://api.adsabs.harvard.edu/v1/search/query?q=${encodeURIComponent(q)}&fl=title,author,year,doi,pub,links_data&rows=${maxResults}`,
    normalize: (data) =>
        data.response?.docs?.map((d) => ({
            title: d.title?.[0] || "Untitled",
            author: d.author?.join(", ") || "Unknown",
            year: d.year,
            abstract: "",
            source: "ADS (NASA Astrophysics)",
            link: d.links_data?.[0]?.url || (d.doi ? `https://doi.org/${d.doi[0]}`: null),
            doi: d.doi?.[0],
        })) || [],
  },
  {
    name: "ClinicalTrials.gov",
    getUrl: (q) => `https://clinicaltrials.gov/api/query/study_fields?expr=${encodeURIComponent(q)}&fields=NCTId,BriefTitle,Condition,Phase,StudyType&min_rnk=1&max_rnk=${maxResults}&fmt=json`,
    normalize: (data) =>
        data.StudyFieldsResponse?.StudyFields?.map((s) => ({
            title: s.BriefTitle?.[0] || "Untitled",
            author: "N/A",
            year: null,
            abstract: `Condition: ${s.Condition?.[0] || 'N/A'}. Phase: ${s.Phase?.[0] || 'N/A'}.`,
            source: "ClinicalTrials.gov",
            link: `https://clinicaltrials.gov/ct2/show/${s.NCTId?.[0]}`,
        })) || [],
  },
  // {
  //     name: "WHO ICTRP",
  //     getUrl: (q) => `https://apps.who.int/trialsearch/api/query?query=${encodeURIComponent(q)}&format=json`,
  //     normalize: (data) => {
  //         // The structure of the response is not documented clearly.
  //         // This is a placeholder.
  //         return [];
  //     }
  // },
  // {
  //     name: "OECD iLibrary open items",
  //     getUrl: (q) => `https://www.oecd-ilibrary.org/search?form=ajax&query=${encodeURIComponent(q)}&access=oa&rows=${maxResults}`,
  //     normalize: (data) => {
  //         // Response is HTML, would need parsing.
  //         return [];
  //     }
  // },
  {
    name: "World Bank Documents",
    getUrl: (q) => `https://search.worldbank.org/api/v3/wds?format=json&qterm=${encodeURIComponent(q)}&fl=docdt,country,display_title,abstracts,pdfurl,url`,
    normalize: (data) => {
        if (!data.documents) return [];
        return Object.values(data.documents).map((d) => ({
            title: d.display_title || "Untitled",
            author: "World Bank",
            year: d.docdt ? new Date(d.docdt).getFullYear() : undefined,
            abstract: d.abstracts?.['cdata!'] || "",
            source: "World Bank Documents",
            link: d.url || d.pdfurl || "#",
        })) || [];
    },
  },
];
